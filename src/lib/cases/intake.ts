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
  | { ok: false; error: string; errorCode: 'duplicate' | 'invalid_category' | 'internal'; existingCaseId?: string };

export async function createCase(input: CaseIntakeInput): Promise<CaseIntakeResult> {
  const db = await getDb();

  const category = await firstOrUndefined(
    db.select().from(categories).where(eq(categories.id, input.categoryId)).limit(1)
  );
  if (!category) {
    return { ok: false, error: 'หมวดหมู่ไม่ถูกต้อง', errorCode: 'invalid_category' };
  }

  if (input.channel === 'web' && input.cid) {
    const dupCheck = await checkDuplicate(input.cid, input.title, input.description);
    if (dupCheck.isDuplicate) {
      return { ok: false, error: 'คุณเคยแจ้งเรื่องนี้ไปแล้วภายใน 7 วัน', errorCode: 'duplicate', existingCaseId: dupCheck.caseId };
    }
  }

  const submitterId = await resolveSubmitter(db, input);
  if (!submitterId) {
    return { ok: false, error: 'ไม่สามารถสร้างผู้ใช้งานได้', errorCode: 'internal' };
  }

  if (input.channel === 'web') {
    await grantConsent({
      userId: submitterId,
      consentType: 'data_collection',
      version: CONSENT_VERSION,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { via: 'intake_submit' },
    });
  }

  const caseId = generateId();
  const fiscalYear = getFiscalYear(new Date());
  const estimatedDays = category.estimatedDays || 7;
  const dueDate = new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000);

  let trackingCode = generateTrackingCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const collision = await firstOrUndefined(
      db.select({ id: cases.id }).from(cases).where(eq(cases.trackingCode, trackingCode)).limit(1)
    );
    if (!collision) break;
    trackingCode = generateTrackingCode();
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
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    }),
    trackingCode,
  });

  if (input.channel === 'web' && input.cid) {
    await recordDedupHash(input.cid, input.title, input.description, caseId);
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
    const linkedUser = input.lineUserId
      ? await firstOrUndefined(
          db.select({ linkedUserId: lineUsers.linkedUserId })
            .from(lineUsers)
            .where(eq(lineUsers.lineUserId, input.lineUserId))
            .limit(1)
        )
      : undefined;

    if (linkedUser?.linkedUserId) return linkedUser.linkedUserId;

    const userId = generateId();
    await db.insert(users).values({
      id: userId,
      email: `line-${input.lineUserId || generateId()}@placeholder.local`,
      role: 'citizen',
      isActive: true,
      fullName: input.fullName || 'ผู้ใช้ LINE',
      metadata: JSON.stringify({ source: 'line_intake' }),
    });
    return userId;
  }

  const cidEmail = input.email || `cid-${generateCidHash(input.cid!)}@placeholder.local`;
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
    metadata: JSON.stringify({ source: 'web_intake' }),
  });
  return userId;
}
