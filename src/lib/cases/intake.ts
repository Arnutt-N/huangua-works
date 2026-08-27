import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { firstOrUndefined } from '../db/query-helpers';
import { cases, categories, lineUsers, users } from '../db/schema';
import { generateId } from '../id';
import { generateTrackingCode } from '../case-tracking';
import { generateCidHash } from '../cid-hmac';
import { checkDuplicate, recordDedupHash } from '../dedup';
import { grantConsent, CONSENT_VERSION } from '../consent';
import { AUDIT_ACTIONS, logAudit } from '../audit';
import { getFiscalYear } from '../thai-date';

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

  const submitterId = await resolveSubmitter(db, input);
  if (!submitterId) {
    return { ok: false, error: 'ไม่สามารถสร้างผู้ใช้งานได้', errorCode: 'internal' };
  }

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
    });
  }

  const caseId = generateId();
  const fiscalYear = getFiscalYear(new Date());
  const estimatedDays = category.estimatedDays || 7;
  const dueDate = new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000);

  // § ตรวจทุกรหัสที่สุ่มได้ก่อนใช้ — เดิมวนสุ่มใหม่ตอนชนแล้วออกจากลูปโดยไม่ได้ตรวจ
  // ตัวสุดท้าย ทำให้รหัสที่ไม่เคยผ่านการตรวจหลุดไปถึง insert แล้วพังที่ unique index
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

  await db.insert(cases).values({
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
    trackingCode,
  });

  if (dedupKey) {
    await recordDedupHash(dedupKey, input.title, input.description, caseId);
  }

  await logAudit({
    userId: submitterId,
    action: AUDIT_ACTIONS.SUBMIT_CASE,
    resource: 'cases',
    resourceId: caseId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: { categoryId: input.categoryId, fiscalYear, channel: input.channel },
  });

  return { ok: true, caseId, trackingCode, estimatedDays };
}

type Db = Awaited<ReturnType<typeof getDb>>;

async function resolveSubmitter(db: Db, input: CaseIntakeInput): Promise<string | null> {
  if (input.channel === 'line') {
    // § เดิม create user ใหม่ทุกครั้งแต่ไม่เขียน lineUsers.linkedUserId กลับ → แจ้งผ่านบอท
    // ครั้งที่ 2 ของ LINE user เดิมชน unique(users.email) กับ placeholder เดิมแล้วกลายเป็น 500
    // ตอนนี้ reuse row เดิมเสมอและเขียน link กลับ เพื่อให้ "เรื่องของฉัน" (LIFF) เห็น
    // เคสที่แจ้งผ่านบอทด้วย
    if (input.lineUserId) {
      const lineRow = await firstOrUndefined(
        db
          .select({ id: lineUsers.id, linkedUserId: lineUsers.linkedUserId })
          .from(lineUsers)
          .where(eq(lineUsers.lineUserId, input.lineUserId))
          .limit(1)
      );
      if (lineRow?.linkedUserId) return lineRow.linkedUserId;

      const email = `line-${input.lineUserId}@placeholder.local`;
      const existingUser = await firstOrUndefined(
        db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
      );
      const userId = existingUser?.id ?? generateId();
      if (!existingUser) {
        await db.insert(users).values({
          id: userId,
          email,
          role: 'citizen',
          isActive: true,
          fullName: input.fullName || 'ผู้ใช้ LINE',
          metadata: JSON.stringify({ source: 'line_intake' }),
        });
      }
      if (lineRow) {
        await db
          .update(lineUsers)
          .set({ linkedUserId: userId, updatedAt: new Date() })
          .where(eq(lineUsers.id, lineRow.id));
      }
      return userId;
    }

    // ไม่มี lineUserId (ไม่ควรเกิดจาก flow จริง) — สร้างแบบไม่ผูก link เหมือนเดิม
    const userId = generateId();
    await db.insert(users).values({
      id: userId,
      email: `line-${generateId()}@placeholder.local`,
      role: 'citizen',
      isActive: true,
      fullName: input.fullName || 'ผู้ใช้ LINE',
      metadata: JSON.stringify({ source: 'line_intake' }),
    });
    return userId;
  }

  // § ตัวตนของผู้แจ้งทางเว็บผูกกับ CID เท่านั้น — ห้ามใช้ input.email เป็น lookup key
  // เดิมใช้ `input.email || cid-hash` ซึ่งเปิดให้ใครก็ได้ยิง /api/cases/submit พร้อม email
  // ของเจ้าหน้าที่ แล้วเคส + consent record ไปผูกกับบัญชีคนนั้นทั้งที่เขาไม่เคยยินยอม
  // (endpoint นี้ไม่ต้อง login — email ที่ส่งมาไม่เคยถูกยืนยัน จึงเป็น identity ไม่ได้)
  //
  // ผลพลอยได้: เดิมคนที่กรอก email จริงจะถอนความยินยอมไม่ได้เลย เพราะ
  // /api/consent/withdraw เทียบกับ `cid-<hash>@placeholder.local` เท่านั้น
  // ผูกทุกคนด้วย CID hash เหมือนกันหมดแล้ว withdraw จึงทำงานครบทุกเคส
  const cidEmail = `cid-${generateCidHash(input.cid!)}@placeholder.local`;
  const existing = await firstOrUndefined(
    db.select().from(users).where(eq(users.email, cidEmail)).limit(1)
  );
  if (existing) return existing.id;

  const userId = generateId();
  await db.insert(users).values({
    id: userId,
    email: cidEmail,
    role: 'citizen',
    isActive: true,
    fullName: input.fullName || 'ประชาชน',
    phoneNumber: input.phoneNumber || null,
    // § email ที่ประชาชนกรอกเก็บเป็น "ช่องทางติดต่อ" ใน metadata ไม่ใช่ identity key
    metadata: JSON.stringify({
      source: 'web_intake',
      ...(input.email ? { contactEmail: input.email } : {}),
    }),
  });
  return userId;
}
