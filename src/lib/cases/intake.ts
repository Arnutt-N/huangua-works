import { and, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { isUniqueViolation } from '../db/errors';
import { getDb, type DbOrTx } from '../db';
import { firstOrUndefined } from '../db/query-helpers';
import { cases, categories, caseNotifications } from '../db/schema';
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
import { notifyNewCase, type NotifyDelivery } from '../notify';

// § lease ครอบระหว่างส่ง — ถ้า worker หยุด รอบถัดไป re-claim เมื่อหมดเวลา (กัน stuck 'sending')
const CLAIM_LEASE_MS = 60_000;
// § ช่องทางล้มเหลวชั่วคราว (5xx/429/network) รอ delay ก่อน cron re-claim
const RETRY_DELAY_MS = 5 * 60_000;

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
  if (result.ok) {
    // § ไม่รอ dispatch ในที่ path ของประชาชน — เคส+outbox commit แล้วจบ (201 ทันที)
    // งานแจ้งเตือนส่งโดย cron worker; dispatch ที่ล้มเหลวหลัง commit ไม่พังคำตอบ (ข้อ 3)
    void dispatchCaseNotification(result.caseId).catch(() => {});
  }
  return result;
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

    // § outbox อยู่ใน tx เดียวกับเรื่อง — rollback ไม่ทิ้งแจ้งเตือน, replay โดน unique(case_id) กัน
    //   ใช้ categoryName ที่อ่านไปแล้ว ไม่ต้อง query ซ้ำตอนส่ง
    await tx.insert(caseNotifications).values({
      id: generateId(),
      caseId,
      trackingCode: issuedTrackingCode,
      title: input.title,
      categoryName: category.name,
      channel: input.channel,
      location: input.location ?? null,
    }).onConflictDoNothing();

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

/** § ส่งหลัง commit เท่านั้น — atomic claim ทำให้ web/LIFF/bot/Replay ส่งได้ครั้งเดียวต่อ case */
export async function dispatchPendingCaseNotifications(limit = 20): Promise<{
  sent: number;
  skipped: number;
  failed: number;
  pending: number;
}> {
  const db = await getDb();
  const now = new Date();
  const owner = generateId();
  const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
  // § re-claim งาน pending ที่ครบ nextAttemptAt (ล้มเหลวชั่วคราว) ก่อน แล้วค่อย 'sending'
  //   ที่ lease หมด (worker หยุดกลางรอบ) — เงื่อนไข due ใน SQL + limit ที่ IN-list
  //   ไม่ให้ claim เกิน batch ที่จะประมวลผลจริง (ข้อ 2)
  const pendingIds = db
    .select({ id: caseNotifications.id })
    .from(caseNotifications)
    .where(and(
      eq(caseNotifications.status, 'pending'),
      or(isNull(caseNotifications.nextAttemptAt), lte(caseNotifications.nextAttemptAt, now)),
    ))
    .limit(limit);
  const claimed = await db
    .update(caseNotifications)
    .set({ status: 'sending', leaseOwner: owner, claimedUntil: leaseUntil, updatedAt: now })
    // § ซ้ำเงื่อนไข status ใน UPDATE ด้วย — claim ต้อง atomic กันคำขออื่น (inline/cron) แย่งแถวเดียวกัน
    .where(and(eq(caseNotifications.status, 'pending'), inArray(caseNotifications.id, pendingIds)))
    .returning();
  let rows = claimed;
  if (rows.length < limit) {
    const stuckIds = db
      .select({ id: caseNotifications.id })
      .from(caseNotifications)
      .where(and(
        eq(caseNotifications.status, 'sending'),
        or(isNull(caseNotifications.claimedUntil), lt(caseNotifications.claimedUntil, now)),
      ))
      .limit(limit - rows.length);
    const recovered = await db
      .update(caseNotifications)
      .set({ status: 'sending', leaseOwner: owner, claimedUntil: leaseUntil, updatedAt: now })
      .where(and(
        eq(caseNotifications.status, 'sending'),
        // § ตรวจ lease ซ้ำใน UPDATE กันแย่งแถวที่ worker อื่นเพิ่ง claim (lease ยังไม่หมด)
        or(isNull(caseNotifications.claimedUntil), lt(caseNotifications.claimedUntil, now)),
        inArray(caseNotifications.id, stuckIds),
      ))
      .returning();
    rows = [...rows, ...recovered];
  }
  return dispatchClaimed(db, rows);
}

/** § claim เฉพาะ caseId (inline หลัง commit) — atomic เหมือน dispatchPending */
async function dispatchCaseNotification(caseId: string): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const owner = generateId();
  const claimed = await db
    .update(caseNotifications)
    .set({ status: 'sending', leaseOwner: owner, claimedUntil: new Date(now.getTime() + CLAIM_LEASE_MS), updatedAt: now })
    .where(and(eq(caseNotifications.caseId, caseId), eq(caseNotifications.status, 'pending')))
    .returning();
  await dispatchClaimed(db, claimed);
}

/**
 * § ตัดสินสถานะแถวจากผลต่อ channel ของ notifyNewCase:
 *   - ทุกช่องทาง sent หรือ skipped (ตั้งใจปิดจาก config) → sent (งานจบ ไม่ต้อง retry)
 *   - มีช่องทาง retryable ที่ยังไม่สำเร็จ → pending + nextAttemptAt (รอ cron re-claim)
 *   - ล้มเหลวถาวรล้วน (4xx) → failed (หยุดพยายาม)
 * ใช้ attempts เป็นเพดานกันวนซ้ำของช่องทางที่พังถาวรแต่ถูก classify ผิด
 */
function outcomeFromDeliveries(deliveries: NotifyDelivery[]): {
  status: 'sent' | 'failed' | 'pending';
  error?: string;
  retry: boolean;
} {
  const retryable = deliveries.filter((d) => d.status === 'failed' && d.retryable);
  if (retryable.length > 0) {
    return { status: 'pending', retry: true, error: retryable.map((d) => `${d.channel}: ${d.error ?? 'retryable'}`).join('; ') };
  }
  const hardFailures = deliveries.filter((d) => d.status === 'failed');
  if (hardFailures.length > 0) {
    return { status: 'failed', retry: false, error: hardFailures.map((d) => `${d.channel}: ${d.error ?? 'failed'}`).join('; ') };
  }
  return { status: 'sent', retry: false };
}

async function dispatchClaimed(db: Awaited<ReturnType<typeof getDb>>, rows: (typeof caseNotifications.$inferSelect)[]): Promise<{
  sent: number;
  skipped: number;
  failed: number;
  pending: number;
}> {
  const tally = { sent: 0, skipped: 0, failed: 0, pending: 0 };
  for (const row of rows) {
    try {
      const deliveries = await notifyNewCase({
        trackingCode: row.trackingCode,
        title: row.title,
        categoryName: row.categoryName,
        channel: row.channel as 'web' | 'line',
        location: row.location ?? undefined,
      });
      const outcome = outcomeFromDeliveries(deliveries);
      await markNotification(db, row.id, row.leaseOwner, outcome.status, outcome.error, outcome.retry);
      tally[outcome.status]++;
    } catch (error) {
      // § notifyNewCase ไม่ควร throw — แต่ถ้ามี (ของใหม่ในอนาคต) ถือเป็น retryable
      // เพราะเรื่อง commit ไปแล้ว งานไม่ควรหายไปจากคิว
      await markNotification(db, row.id, row.leaseOwner, 'pending', error instanceof Error ? error.message : String(error), true);
      tally.pending++;
    }
  }
  return tally;
}

async function markNotification(
  db: Awaited<ReturnType<typeof getDb>>,
  id: string,
  owner: string | null,
  status: 'sent' | 'failed' | 'pending',
  error?: string,
  retry = false,
): Promise<void> {
  const now = new Date();
  await db.update(caseNotifications).set({
    status,
    attempts: sql`${caseNotifications.attempts} + 1`,
    lastError: error?.slice(0, 500) ?? null,
    // § ปล่อย lease เสมอ; ถ้า retry ตั้งรอบลองใหม่ให้ครบ delay แล้ว cron re-claim
    leaseOwner: null,
    claimedUntil: null,
    nextAttemptAt: retry ? new Date(now.getTime() + RETRY_DELAY_MS) : null,
    updatedAt: now,
  }).where(and(
    eq(caseNotifications.id, id),
    // § เขียนผลเฉพาะ worker ที่ยังถือ lease (owner เดิม) — คนที่ถูก re-claim แล้วห้ามทับ
    owner === null ? isNull(caseNotifications.leaseOwner) : eq(caseNotifications.leaseOwner, owner),
  ));
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
