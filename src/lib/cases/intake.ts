import { eq } from 'drizzle-orm';
import { isUniqueViolation } from '../db/errors';
import { getDb, type DbOrTx } from '../db';
import { firstOrUndefined } from '../db/query-helpers';
import { cases, categories } from '../db/schema';
import { generateId } from '../id';
import { generateTrackingCode } from '../case-tracking';
import { checkDuplicate, claimDedupHash } from '../dedup';
import { AUDIT_ACTIONS, logAudit } from '../audit';
import { getFiscalYear } from '../thai-date';
import { keyFromUrl } from '../storage';
import {
  recordIntakeConsent,
  resolveCitizen,
  type CitizenIdentity,
  type IntakeConsentVia,
} from './citizen-access';
import { notifyNewCase } from '../notify';

export interface CaseIntakeInput {
  channel: 'web' | 'line';
  /** 'liff' = มาจากฟอร์มใน LIFF (channel เป็น line แต่เป็นฟอร์มเว็บ ไม่ใช่บอท) */
  origin?: 'liff';
  title: string;
  description: string;
  location?: string;
  categoryId: string;
  cid?: string;
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  provinceId?: number;
  districtId?: number;
  subDistrictId?: number;
  villageId?: number;
  village?: string;
  attachments?: { url: string; type: string; size: number }[];
  lineUserId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/** ใช้เพื่อ rollback transaction เมื่อ unique(hash) ให้สิทธิ์เรื่องอื่นไปแล้ว */
class ClaimLostError extends Error {
  constructor(readonly existingTrackingCode?: string) {
    super('dedup claim lost');
  }
}

export type CaseIntakeResult =
  | { ok: true; caseId: string; trackingCode: string; estimatedDays: number }
  | { ok: false; error: string; errorCode: 'duplicate' | 'invalid_category' | 'invalid_attachment' | 'internal'; existingTrackingCode?: string };

export async function createCase(input: CaseIntakeInput): Promise<CaseIntakeResult> {
  // § กัน input ผิดก่อนเปิด transaction — ด่านเดิมอยู่ก่อนแตะ DB และเทสต์ยืนยันพฤติกรรมนี้
  if (!citizenIdentityOf(input)) {
    console.error(`[intake] createCase ไม่มีตัวตนผู้แจ้ง (channel=${input.channel})`);
    return { ok: false, error: 'ไม่สามารถสร้างผู้ใช้งานได้', errorCode: 'internal' };
  }
  const db = await getDb();
  let result: CaseIntakeResult;
  try {
    // § rollback ต้องเกิดนอก catch — ถ้าจับ ClaimLostError ใน tx แล้วคืน duplicate tx จะ commit เรื่องค้าง
    result = await db.transaction((tx) => createCaseInTx(tx, input));
  } catch (error) {
    result = intakeFailureFrom(error);
  }
  return notifyOnResult(result, input);
}

/** § เรียกจาก effects tx ได้โดยไม่เปิด transaction ซ้อน — ทุก write อยู่ใน tx เดียวกับ caller */
export async function createCaseInTx(db: DbOrTx, input: CaseIntakeInput): Promise<CaseIntakeResult> {
  // § ด่าน input ก่อนแตะ DB — ไม่มีตัวตน (เว็บไม่มี cid / line ไม่มี lineUserId) = caller ส่ง input ผิด
  // คืน internal แทน throw (caller map เป็น 500/ข้อความทั่วไป) + log ให้เห็น (ไม่มี PII — แค่ channel)
  const identity = citizenIdentityOf(input);
  if (!identity) {
    console.error(`[intake] createCase ไม่มีตัวตนผู้แจ้ง (channel=${input.channel})`);
    return { ok: false, error: 'ไม่สามารถสร้างผู้ใช้งานได้', errorCode: 'internal' };
  }

  // § attachments[].url มาจาก /api/cases/submit ซึ่งไม่ต้อง login — เดิมรับ URL ภายนอก
  // อะไรก็ได้ (บังคับแค่ http/https) = ฝัง URL ของคนอื่นลง DB รอวันมีหน้าเอาไป render
  // ตอนนี้รับเฉพาะ URL ที่ชี้ storage ของเรา แล้วแปลงเป็น key ก่อนเก็บ
  let storageKeys: { key: string; type: string; size: number }[] | null = null;
  if (input.attachments?.length) {
    storageKeys = [];
    for (const att of input.attachments) {
      const key = keyFromUrl(att.url);
      if (!key) {
        return {
          ok: false,
          error: 'ไฟล์แนบต้องเป็นไฟล์ที่อัปโหลดผ่านระบบนี้เท่านั้น',
          errorCode: 'invalid_attachment',
        };
      }
      storageKeys.push({ key, type: att.type, size: att.size });
    }
  }

  const category = await firstOrUndefined(
    db.select().from(categories).where(eq(categories.id, input.categoryId)).limit(1)
  );
  if (!category) {
    return { ok: false, error: 'หมวดหมู่ไม่ถูกต้อง', errorCode: 'invalid_category' };
  }

  // § dedup key: เว็บใช้ CID, ช่องทาง LINE ใช้ lineUserId (prefix 'line:' กันชนกับ
  // เลข CID จริงใน HMAC payload) — ก่อนหน้านี้ช่องทาง LINE ไม่มี dedup เลย
  // LIFF ทำให้แจ้งง่ายขึ้นจึงต้องกันซ้ำด้วย key เดียวกันทั้งบอทและ LIFF
  const dedupKey =
    input.channel === 'web' && input.cid
      ? input.cid
      : input.channel === 'line' && input.lineUserId
        ? `line:${input.lineUserId}`
        : null;
  const caseId = generateId();
  const fiscalYear = getFiscalYear(new Date());
  const estimatedDays = category.estimatedDays || 7;
  const dueDate = new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000);

  // § การเขียนผู้แจ้ง/link/consent/เรื่อง/dedup/audit ต้อง commit หรือ rollback พร้อมกัน
  // ระบุตัวตนด้วย resolveCitizen ใน tx นี้ (ลบ resolveSubmitter แล้ว — ดู citizen-access)
  const tx = db;
      // § ตัดสิน duplicate ใน transaction เดียวกับ insert และก่อน resolveCitizen —
      // ด่านเดิมอยู่นอก tx (สองคำขอผ่านพร้อมกันได้) แต่ถ้าย้ายเข้ามาโดยไม่เลื่อนขึ้นก่อน
      // duplicate submit จะทิ้ง user row ค้างไว้
      if (dedupKey) {
        const dupCheck = await checkDuplicate(dedupKey, input.title, input.description, tx);
        if (dupCheck.isDuplicate) {
          // § reveal policy: เฉพาะ channel line ที่ verify แล้วเท่านั้นที่ได้ trackingCode เดิม
          // ฝั่ง web(cid) attacker ที่รู้ CID + title/desc ได้ bare 409 (review PR #73)
          const provenOwner = input.channel === 'line' && Boolean(input.lineUserId);
          let existingTrackingCode: string | undefined;
          if (provenOwner && dupCheck.caseId) {
            const existing = await firstOrUndefined(
              tx.select({ trackingCode: cases.trackingCode }).from(cases).where(eq(cases.id, dupCheck.caseId)).limit(1),
            );
            existingTrackingCode = existing?.trackingCode ?? undefined;
          }
          return {
            ok: false,
            error: 'คุณเคยแจ้งเรื่องนี้ไปแล้วภายใน 7 วัน',
            errorCode: 'duplicate',
            ...(existingTrackingCode ? { existingTrackingCode } : {}),
          };
        }
      }

      const submitterId = await resolveCitizen(identity, tx);

    // § ทุกช่องทางบันทึกความยินยอมตอนแจ้ง — เดิมบอทไม่บันทึกเพราะไม่มี checkbox ในแชท
    // ผลคือเรื่องจากบอท 404 บน /track ขณะที่บอทเองโชว์ได้ (กติกาไม่เท่ากัน)
    // ตอนนี้บอทแจ้ง BOT_CONSENT_NOTICE ก่อน "ยืนยัน" แล้วบันทึกเป็น line_bot_submit
    await recordIntakeConsent(
      submitterId,
      intakeConsentVia(input),
      { ipAddress: input.ipAddress, userAgent: input.userAgent },
      tx,
    );

      // § unique index (cases_tracking_code_idx) เป็นตัวตัดสิน — SELECT ก่อน insert
      // ไม่พอเพราะสองคำขอคนละเรื่องสุ่มเลขเดียวกันได้ ก่อนหน้านี้ insert พัง 500
      // § ใช้ savepoint ต่อ collision เพื่อไม่ให้ error 23505 ทำให้ทั้ง tx abort
      const caseValues: typeof cases.$inferInsert = {
        id: caseId,
        status: 'pending',
        priority: 'normal',
        title: input.title,
        description: input.description,
        location: input.location ?? '',
        provinceId: input.provinceId ?? null,
        districtId: input.districtId ?? null,
        subDistrictId: input.subDistrictId ?? null,
        villageId: input.villageId ?? null,
        village: input.village || null,
        categoryId: input.categoryId,
        submittedBy: submitterId,
        departmentId: category.defaultDepartmentId || null,
        dueDate,
        attachments: storageKeys ? JSON.stringify(storageKeys) : null,
        metadata: JSON.stringify({
          fiscalYear,
          source: input.channel,
          ...(input.origin === 'liff' ? { origin: 'liff' } : {}),
          // § ไม่เก็บ ipAddress/userAgent ที่นี่ — IP อยู่ใน auditLogs (มี retention ลบตาม
          // cleanup-audit-logs) ส่วน cases.metadata ไม่มีลบ เก็บถาวรขัด PDPA retention
        }),
        trackingCode: null,
      };

      let issuedTrackingCode: string | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateTrackingCode();
        try {
          await db.transaction(async (savepoint) => {
            await savepoint.insert(cases).values({ ...caseValues, trackingCode: candidate });
          });
          issuedTrackingCode = candidate;
          break;
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
        }
      }
      if (!issuedTrackingCode) {
        // § ต้อง rollback user/consent ที่สร้างไปแล้ว — return จากใน tx จะ commit ของค้าง
        throw new Error('tracking code exhausted');
      }

      if (dedupKey) {
        const claimed = await claimDedupHash(dedupKey, input.title, input.description, caseId, tx);
        if (claimed.caseId !== caseId) {
          // § ต้อง rollback เรื่องที่เพิ่ง insert มิเช่นนั้น caller ได้ duplicate แต่ DB มีเรื่องค้าง
          // ดึงเลขเรื่องเดิมก่อน throw เพื่อรักษาสัญญา existingTrackingCode ทุกช่องทาง (รวม race)
          const provenOwner = input.channel === 'line' && Boolean(input.lineUserId);
          const existing = provenOwner
            ? await firstOrUndefined(
                tx.select({ trackingCode: cases.trackingCode }).from(cases).where(eq(cases.id, claimed.caseId)).limit(1),
              )
            : undefined;
          throw new ClaimLostError(existing?.trackingCode ?? undefined);
        }
      }

      await logAudit({
        userId: submitterId,
        action: AUDIT_ACTIONS.SUBMIT_CASE,
        resource: 'cases',
        resourceId: caseId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: { categoryId: input.categoryId, fiscalYear, channel: input.channel },
      }, tx);

    return { ok: true, caseId, trackingCode: issuedTrackingCode, estimatedDays };
}

/** § แปลง error จาก tx ที่ rollback แล้วให้เป็นคำตอบ — เรียกนอก transaction เสมอ */
function intakeFailureFrom(error: unknown): CaseIntakeResult {
  if (error instanceof ClaimLostError) {
    return {
      ok: false,
      error: 'คุณเคยแจ้งเรื่องนี้ไปแล้วภายใน 7 วัน',
      errorCode: 'duplicate',
      ...(error.existingTrackingCode ? { existingTrackingCode: error.existingTrackingCode } : {}),
    };
  }
  if (error instanceof Error && error.message === 'tracking code exhausted') {
    return { ok: false, error: 'ไม่สามารถออกเลขติดตามได้ กรุณาลองใหม่', errorCode: 'internal' };
  }
  throw error;
}

/** § แจ้งเจ้าหน้าที่หลัง commit สำเร็จเท่านั้น — fail-open สองชั้น (notifyNewCase สัญญา
 * ไม่ throw อยู่แล้ว + try/catch นี้กันของใหม่ในอนาคต) เพราะเคสถูกบันทึกไปแล้ว
 * การแจ้งเตือนพังต้องไม่ลอยขึ้นไปทำให้ผู้แจ้งได้ error ทั้งที่เรื่องถูกรับไว้แล้ว */
async function notifyOnResult(result: CaseIntakeResult, input: CaseIntakeInput): Promise<CaseIntakeResult> {
  if (result.ok) {
    try {
      const db = await getDb();
      const category = await firstOrUndefined(db.select().from(categories).where(eq(categories.id, input.categoryId)).limit(1));
      await notifyNewCase({
        trackingCode: result.trackingCode,
        title: input.title,
        categoryName: category?.name ?? '',
        channel: input.channel,
        location: input.location,
      });
    } catch (error) {
      console.warn('[notify] new-case notice failed', error);
    }
  }
  return result;
}

/**
 * แปลง input ของการแจ้งเรื่องใหม่ → ตัวตนที่ citizen-access เข้าใจ
 * เว็บผูกกับ CID / ช่องทาง LINE (บอท + LIFF) ผูกกับ lineUserId ที่ verify แล้ว
 *
 * § ขาด key (เว็บไม่มี cid / line ไม่มี lineUserId) ไม่เกิดจาก flow จริง (zod + session
 * บังคับไว้แล้ว) — เดิมสาย line สร้าง user ลอยไม่ผูก link ซึ่งทำให้เรื่องนั้นไม่มีเจ้าของ
 * ที่ติดตาม/ถอนความยินยอมได้ ตอนนี้ตอบ internal แทน
 */
function citizenIdentityOf(input: CaseIntakeInput): CitizenIdentity | null {
  if (input.channel === 'line') {
    return input.lineUserId
      ? { kind: 'line', lineUserId: input.lineUserId, fullName: input.fullName, source: 'line_intake' }
      : null;
  }
  return input.cid
    ? {
        kind: 'cid',
        cid: input.cid,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        contactEmail: input.email,
      }
    : null;
}

function intakeConsentVia(input: CaseIntakeInput): IntakeConsentVia {
  if (input.channel === 'web') return 'intake_submit';
  return input.origin === 'liff' ? 'liff_submit' : 'line_bot_submit';
}
