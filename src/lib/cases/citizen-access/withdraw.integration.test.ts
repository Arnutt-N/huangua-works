import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { auditLogs, cases, categories, consentRecords, lineUsers, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { findTrackableCase, resolveCitizen, withdrawCaseConsent } from './index';

/**
 * withdrawCaseConsent — ถอนความยินยอม PDPA ด้วยหลักฐานความเป็นเจ้าของสองแบบ
 * (CID สำหรับผู้แจ้งทางเว็บ / LINE session สำหรับผู้แจ้งผ่าน LINE) รันกับ Postgres จริง
 */

const RUN = Date.now();
const SUFFIX = String(RUN % 100_000_000).padStart(8, '0');
const CODE_CID = `HG5${SUFFIX}`;
const CODE_LINE = `HG4${SUFFIX}`;
const CID = `it-ca-withdraw-cid-${RUN}`;
const LINE_OWNER = `U-it-ca-wd-owner-${RUN}`;
const LINE_STRANGER = `U-it-ca-wd-stranger-${RUN}`;
const CTX = { ipAddress: '203.0.113.7', userAgent: 'vitest' };

let categoryId: string;
let cidOwnerId: string;
let lineOwnerId: string;
let strangerId: string;
let cidCaseId: string;
let lineCaseId: string;

async function seedCase(trackingCode: string, submittedBy: string): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.insert(cases).values({
    id,
    status: 'received',
    priority: 'normal',
    title: `เรื่องทดสอบถอนความยินยอม ${trackingCode}`,
    description: 'รายละเอียดทดสอบ',
    location: 'ทดสอบ ตำบลหัวงัว',
    categoryId,
    submittedBy,
    trackingCode,
  });
  return id;
}

async function auditMetaOf(caseId: string, action: string): Promise<Array<Record<string, unknown>>> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.resourceId, caseId), eq(auditLogs.action, action)));
  return rows.map((r) => (r.metadata ?? {}) as Record<string, unknown>);
}

beforeAll(async () => {
  const db = await getDb();
  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน `npx tsx scripts/seed.ts` ก่อน');
  categoryId = category.id;

  cidOwnerId = await resolveCitizen({ kind: 'cid', cid: CID, fullName: 'ผู้แจ้งเว็บทดสอบถอน' });
  lineOwnerId = await resolveCitizen({ kind: 'line', lineUserId: LINE_OWNER, source: 'liff_session' });
  strangerId = await resolveCitizen({ kind: 'line', lineUserId: LINE_STRANGER, source: 'liff_session' });

  await db.insert(consentRecords).values([cidOwnerId, lineOwnerId].map((userId) => ({
    id: generateId(),
    userId,
    consentType: 'data_collection',
    version: '1.1',
    isGranted: true,
    grantedAt: new Date(),
  })));

  cidCaseId = await seedCase(CODE_CID, cidOwnerId);
  lineCaseId = await seedCase(CODE_LINE, lineOwnerId);
});

afterAll(async () => {
  const db = await getDb();
  const caseIds = [cidCaseId, lineCaseId];
  const userIds = [cidOwnerId, lineOwnerId, strangerId];
  await db.delete(auditLogs).where(inArray(auditLogs.resourceId, caseIds));
  await db.delete(cases).where(inArray(cases.id, caseIds));
  await db.delete(consentRecords).where(inArray(consentRecords.userId, userIds));
  await db.delete(lineUsers).where(inArray(lineUsers.lineUserId, [LINE_OWNER, LINE_STRANGER]));
  await db.delete(users).where(inArray(users.id, userIds));
  await closeDb();
});

describe('withdrawCaseConsent · ปฏิเสธ', () => {
  test('เลขติดตามผิดรูปแบบ / ไม่มีอยู่ → ปฏิเสธ', async () => {
    expect(await withdrawCaseConsent('not-a-code', { kind: 'cid', cid: CID }, CTX)).toEqual({ ok: false });
    expect(await withdrawCaseConsent(`HG2${SUFFIX}`, { kind: 'cid', cid: CID }, CTX)).toEqual({ ok: false });
  });

  test('§ CID ไม่ตรงเจ้าของ → ปฏิเสธ + audit cid_mismatch และเรื่องยังติดตามได้', async () => {
    const result = await withdrawCaseConsent(CODE_CID, { kind: 'cid', cid: `${CID}-wrong` }, CTX);

    expect(result).toEqual({ ok: false });
    expect(await auditMetaOf(cidCaseId, 'consent_withdraw_denied')).toContainEqual({ reason: 'cid_mismatch' });
    expect(await findTrackableCase(CODE_CID, { channel: 'web' })).not.toBeNull();
  });

  test('§ LINE คนอื่นที่ไม่ใช่เจ้าของ → ปฏิเสธ + audit not_case_owner_line', async () => {
    const result = await withdrawCaseConsent(CODE_LINE, { kind: 'line', lineUserId: LINE_STRANGER }, CTX);

    expect(result).toEqual({ ok: false });
    expect(await auditMetaOf(lineCaseId, 'consent_withdraw_denied')).toContainEqual({ reason: 'not_case_owner_line' });
    expect(await findTrackableCase(CODE_LINE, { channel: 'line_bot' })).not.toBeNull();
  });
});

describe('withdrawCaseConsent · สำเร็จ', () => {
  test('เจ้าของผ่าน LINE ถอน → เรื่องหายจากการติดตามทุกช่องทาง + audit consent_withdrawn via liff', async () => {
    const result = await withdrawCaseConsent(CODE_LINE, { kind: 'line', lineUserId: LINE_OWNER }, CTX);

    expect(result).toEqual({ ok: true });
    expect(await findTrackableCase(CODE_LINE, { channel: 'web' })).toBeNull();
    expect(await findTrackableCase(CODE_LINE, { channel: 'line_bot' })).toBeNull();
    expect(await auditMetaOf(lineCaseId, 'consent_withdrawn')).toContainEqual({ trackingCode: CODE_LINE, via: 'liff' });
  });

  test('เจ้าของผ่าน CID ถอน (พิมพ์เลขมีเว้นวรรค) → เรื่องหายจากการติดตาม + audit via web', async () => {
    const typed = `${CODE_CID.slice(0, 2)} ${CODE_CID.slice(2)}`;
    const result = await withdrawCaseConsent(typed, { kind: 'cid', cid: CID }, CTX);

    expect(result).toEqual({ ok: true });
    expect(await findTrackableCase(CODE_CID, { channel: 'web' })).toBeNull();
    expect(await auditMetaOf(cidCaseId, 'consent_withdrawn')).toContainEqual({ trackingCode: CODE_CID, via: 'web' });
  });
});
