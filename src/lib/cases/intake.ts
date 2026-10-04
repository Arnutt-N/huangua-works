import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { firstOrUndefined } from '../db/query-helpers';
import { cases, categories } from '../db/schema';
import { generateId } from '../id';
import { generateTrackingCode } from '../case-tracking';
import { checkDuplicate, recordDedupHash } from '../dedup';
import { grantConsent, CONSENT_VERSION } from '../consent';
import { AUDIT_ACTIONS, logAudit } from '../audit';
import { getFiscalYear } from '../thai-date';
import { resolveCitizen, type CitizenIdentity } from './citizen-access';

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

export type CaseIntakeResult =
  | { ok: true; caseId: string; trackingCode: string; estimatedDays: number }
  | { ok: false; error: string; errorCode: 'duplicate' | 'invalid_category' | 'internal'; existingTrackingCode?: string };

export async function createCase(input: CaseIntakeInput): Promise<CaseIntakeResult> {
  const db = await getDb();

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
  if (dedupKey) {
    const dupCheck = await checkDuplicate(dedupKey, input.title, input.description);
    if (dupCheck.isDuplicate) {
      // § reveal policy: คืน trackingCode เฉพาะเมื่อพิสูจน์ว่าผู้ขอ = เจ้าของเรื่องเดิม
      // channel 'line' = lineUserId ผ่านการ verify มาแล้วเสมอ (LIFF: HMAC session
      // cookie ที่ server sign, บอท: LINE webhook จากเซิร์ฟเวอร์ LINE) — ปลอมไม่ได้
      // ฝั่ง web(cid): attacker ที่รู้ cid ใครก็ได้+เดา title/desc ตรงเป๊ะ อาจถาม
      // รู้ตัวแล้ว → bare 409 ไม่คืนอะไรเลย (review PR #73 suggestion #1)
      const provenOwner = input.channel === 'line' && Boolean(input.lineUserId);
      let existingTrackingCode: string | undefined;
      if (provenOwner && dupCheck.caseId) {
        const existing = await firstOrUndefined(
          db.select({ trackingCode: cases.trackingCode }).from(cases).where(eq(cases.id, dupCheck.caseId)).limit(1),
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

  const caseId = generateId();
  const fiscalYear = getFiscalYear(new Date());
  const estimatedDays = category.estimatedDays || 7;
  const dueDate = new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000);

  // § ตรวจทุกรหัสที่สุ่มได้ก่อนใช้ — เดิมวนสุ่มใหม่ตอนชนแล้วออกจากลูปโดยไม่ได้ตรวจ
  // ตัวสุดท้าย ทำให้รหัสที่ไม่เคยผ่านการตรวจหลุดไปถึง insert แล้วพังที่ unique index
  // § ออกเลขติดตามก่อนสร้างผู้แจ้ง เพื่อไม่ทิ้ง user/consent เมื่อออกเลขไม่ได้
  let trackingCode: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateTrackingCode();
    const collision = await firstOrUndefined(
      db.select({ id: cases.id }).from(cases).where(eq(cases.trackingCode, candidate)).limit(1)
    );
    if (!collision) {
      trackingCode = candidate;
      break;
    }
  }
  if (!trackingCode) {
    return { ok: false, error: 'ไม่สามารถออกเลขติดตามได้ กรุณาลองใหม่', errorCode: 'internal' };
  }

  const issuedTrackingCode = trackingCode;

  // § การเขียนผู้แจ้ง/link/consent/เรื่อง/dedup/audit ต้อง commit หรือ rollback พร้อมกัน
  // ระบุตัวตนด้วย resolveCitizen ใน tx นี้ (ลบ resolveSubmitter แล้ว — ดู citizen-access)
  return db.transaction(async (tx): Promise<CaseIntakeResult> => {
    const identity = citizenIdentityOf(input);
    if (!identity) {
      return { ok: false, error: 'ไม่สามารถสร้างผู้ใช้งานได้', errorCode: 'internal' };
    }
    const submitterId = await resolveCitizen(identity, tx);

    // § LIFF เป็นฟอร์มเว็บในหน้าต่าง LINE — consent เก็บเท่ากับทางเว็บ (ต่างจากบอท
    // ซึ่งเก็บข้อมูลน้อยกว่าและไม่มี checkbox ความยินยอมในแชท)
    if (input.channel === 'web' || input.origin === 'liff') {
      await grantConsent({
        userId: submitterId,
        consentType: 'data_collection',
        version: CONSENT_VERSION,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: { via: input.origin === 'liff' ? 'liff_submit' : 'intake_submit' },
      }, tx);
    }

    await tx.insert(cases).values({
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
      attachments: input.attachments ? JSON.stringify(input.attachments) : null,
      metadata: JSON.stringify({
        fiscalYear,
        source: input.channel,
        ...(input.origin === 'liff' ? { origin: 'liff' } : {}),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }),
      trackingCode: issuedTrackingCode,
    });

    if (dedupKey) {
      await recordDedupHash(dedupKey, input.title, input.description, caseId, tx);
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
  });
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
