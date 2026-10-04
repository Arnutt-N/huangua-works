import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { auditLogs, caseUpdates, cases, categories, consentRecords, lineUsers, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { findTrackableCase, listMyCases } from './index';

/**
 * findTrackableCase / listMyCases — กติกาการมองเห็นเรื่องของประชาชนชุดเดียวทุกช่องทาง
 * รันกับ Postgres จริง: docker compose up -d postgres redis up-redis
 */

const RUN = Date.now();
const SUFFIX = String(RUN % 100_000_000).padStart(8, '0');
const CODE_A = `HG7${SUFFIX}`;
const CODE_B = `HG6${SUFFIX}`;
const CODE_NO_CONSENT = `HG3${SUFFIX}`;
const LINE_OWNER = `U-it-ca-view-${RUN}`;

let categoryId: string;
let ownerId: string;
let noConsentOwnerId: string;
let lineRowId: string;
let caseAId: string;
const caseIds: string[] = [];

async function seedCase(values: {
  submittedBy: string;
  trackingCode: string | null;
  title: string;
  updatedAt: Date;
}): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.insert(cases).values({
    id,
    status: 'received',
    priority: 'normal',
    title: values.title,
    description: 'รายละเอียดลับ ห้ามหลุดไปหาประชาชนคนอื่น',
    location: 'บ้านเลขที่ 99 หมู่ 3',
    categoryId,
    submittedBy: values.submittedBy,
    trackingCode: values.trackingCode,
    updatedAt: values.updatedAt,
  });
  caseIds.push(id);
  return id;
}

beforeAll(async () => {
  const db = await getDb();
  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน `npx tsx scripts/seed.ts` ก่อน');
  categoryId = category.id;

  ownerId = generateId();
  noConsentOwnerId = generateId();
  await db.insert(users).values([
    { id: ownerId, email: `it-ca-view-owner-${RUN}@placeholder.local`, role: 'citizen', isActive: true, fullName: 'เจ้าของเรื่องทดสอบ' },
    { id: noConsentOwnerId, email: `it-ca-view-noconsent-${RUN}@placeholder.local`, role: 'citizen', isActive: true, fullName: 'ผู้แจ้งไม่มีบันทึกความยินยอม' },
  ]);
  lineRowId = generateId();
  await db.insert(lineUsers).values({ id: lineRowId, lineUserId: LINE_OWNER, linkedUserId: ownerId });
  await db.insert(consentRecords).values({
    id: generateId(),
    userId: ownerId,
    consentType: 'data_collection',
    version: '1.1',
    isGranted: true,
    grantedAt: new Date(),
  });

  caseAId = await seedCase({ submittedBy: ownerId, trackingCode: CODE_A, title: 'ถนนพังหน้าวัด (ทดสอบ)', updatedAt: new Date('2026-01-01T00:00:00.000Z') });
  await seedCase({ submittedBy: ownerId, trackingCode: CODE_B, title: 'ไฟดับซอย 3 (ทดสอบ)', updatedAt: new Date('2026-02-01T00:00:00.000Z') });
  await seedCase({ submittedBy: ownerId, trackingCode: null, title: 'เรื่องเก่าไม่มีเลขติดตาม', updatedAt: new Date('2026-03-01T00:00:00.000Z') });
  await seedCase({ submittedBy: noConsentOwnerId, trackingCode: CODE_NO_CONSENT, title: 'เรื่องที่ไม่มีบันทึกความยินยอม', updatedAt: new Date() });

  await db.insert(caseUpdates).values([
    { id: generateId(), caseId: caseAId, userId: ownerId, updateType: 'status_change', oldValue: 'pending', newValue: 'received', isPublic: true },
    { id: generateId(), caseId: caseAId, userId: ownerId, updateType: 'comment', comment: 'บันทึกภายใน ไม่แสดงให้ประชาชนเห็น', isPublic: false },
  ]);
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(auditLogs).where(inArray(auditLogs.resourceId, caseIds));
  await db.delete(caseUpdates).where(inArray(caseUpdates.caseId, caseIds));
  await db.delete(cases).where(inArray(cases.id, caseIds));
  await db.delete(consentRecords).where(inArray(consentRecords.userId, [ownerId, noConsentOwnerId]));
  await db.delete(lineUsers).where(eq(lineUsers.id, lineRowId));
  await db.delete(users).where(inArray(users.id, [ownerId, noConsentOwnerId]));
  await closeDb();
});

describe('findTrackableCase', () => {
  test('คืนเฉพาะข้อมูลที่ประชาชนเห็นได้ — ไม่มี PII, ไทม์ไลน์เฉพาะ public, รับเลขที่พิมพ์มีเว้นวรรค', async () => {
    const typed = ` ${CODE_A.slice(0, 6).toLowerCase()} ${CODE_A.slice(6)} `;
    const view = await findTrackableCase(typed, { channel: 'web' });

    expect(view).not.toBeNull();
    expect(view!.case.trackingCode).toBe(CODE_A);
    expect(view!.case.title).toBe('ถนนพังหน้าวัด (ทดสอบ)');
    expect(view!.category?.id).toBe(categoryId);
    expect(Object.keys(view!.case).sort()).toEqual([
      'closedAt', 'createdAt', 'dueDate', 'id', 'priority', 'status', 'title', 'trackingCode', 'updatedAt',
    ]);
    expect(view!.updates).toHaveLength(1);
    expect(view!.updates[0]!.updateType).toBe('status_change');
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('บ้านเลขที่ 99');
    expect(serialized).not.toContain('รายละเอียดลับ');
    expect(serialized).not.toContain(ownerId);
  });

  test('รูปแบบผิด / ไม่มีเลขนี้ → null (คำตอบเดียวกับไม่พบ)', async () => {
    expect(await findTrackableCase('019f5c00-932f-776b-9203-ac13c48c2937', { channel: 'web' })).toBeNull();
    expect(await findTrackableCase(`HG2${SUFFIX}`, { channel: 'line_bot' })).toBeNull();
  });

  test('§ ไม่มีบันทึกความยินยอมเลย → null ทุกช่องทาง', async () => {
    expect(await findTrackableCase(CODE_NO_CONSENT, { channel: 'web' })).toBeNull();
    expect(await findTrackableCase(CODE_NO_CONSENT, { channel: 'line_bot' })).toBeNull();
  });

  test('ทุกการเข้าดูถูก audit พร้อมช่องทาง', async () => {
    await findTrackableCase(CODE_A, { channel: 'web', ipAddress: '203.0.113.9', userAgent: 'vitest' });
    await findTrackableCase(CODE_A, { channel: 'line_bot' });

    const db = await getDb();
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resourceId, caseAId), eq(auditLogs.action, 'view_case')));
    const vias = rows.map((r) => (r.metadata as { via?: string } | null)?.via);
    expect(vias).toContain('tracking_code');
    expect(vias).toContain('line_bot');
    expect(rows.some((r) => r.ipAddress === '203.0.113.9')).toBe(true);
  });
});

describe('listMyCases', () => {
  test('เรื่องของฉัน: เฉพาะของ LINE user นี้ ที่มีเลขติดตาม เรียงที่อัปเดตล่าสุดก่อน', async () => {
    const items = await listMyCases(LINE_OWNER);

    expect(items.map((i) => i.trackingCode)).toEqual([CODE_B, CODE_A]);
    expect(items[0]).toEqual({
      trackingCode: CODE_B,
      status: 'received',
      title: 'ไฟดับซอย 3 (ทดสอบ)',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
  });

  test('LINE user ที่ไม่ได้ผูกกับใคร → []', async () => {
    expect(await listMyCases(`U-it-ca-nobody-${RUN}`)).toEqual([]);
  });

  test('ไม่เขียน audit — ผู้ดูคือเจ้าของ LIFF ที่ยืนยันตัวแล้ว ไม่ใช่การค้นเลขติดตามแบบไม่ล็อกอิน', async () => {
    const db = await getDb();
    const before = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(eq(auditLogs.resourceId, caseAId));
    await listMyCases(LINE_OWNER);
    const after = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(eq(auditLogs.resourceId, caseAId));
    expect(after).toHaveLength(before.length);
  });
});

describe('§ ถอนความยินยอมแล้ว — ซ่อนทุกช่องทาง', () => {
  test('record ล่าสุดเป็นการถอน → เว็บ/บอทไม่พบ และเรื่องของฉันว่าง', async () => {
    const db = await getDb();
    await db.insert(consentRecords).values({
      id: generateId(),
      userId: ownerId,
      consentType: 'data_collection',
      version: '1.1',
      isGranted: false,
      revokedAt: new Date(),
    });

    expect(await findTrackableCase(CODE_A, { channel: 'web' })).toBeNull();
    expect(await findTrackableCase(CODE_A, { channel: 'line_bot' })).toBeNull();
    expect(await listMyCases(LINE_OWNER)).toEqual([]);
  });

  test('timestamp เท่ากัน → id DESC เป็นตัวตัดสิน (UUID v7); grant ระดับ user ทำให้เรื่องเก่ากลับมา', async () => {
    const db = await getDb();
    // § ต้องใหม่กว่า revoke ของ test ก่อนหน้า (createdAt = now) จึงใช้เวลาตอนรัน —
    // วันตายตัวในอดีตไม่มีทางเป็น "ล่าสุด" ได้
    const sameTime = new Date();
    const olderId = '00000000-0000-7000-8000-000000000001';
    const newerId = 'ffffffff-ffff-7fff-bfff-ffffffffffff';
    await db.insert(consentRecords).values([
      {
        id: newerId,
        userId: ownerId,
        consentType: 'data_collection',
        version: '1.1',
        isGranted: true,
        grantedAt: sameTime,
        createdAt: sameTime,
      },
      {
        id: olderId,
        userId: ownerId,
        consentType: 'data_collection',
        version: '1.1',
        isGranted: false,
        revokedAt: sameTime,
        createdAt: sameTime,
      },
    ]);

    // id มากกว่าชนะแม้ created_at เท่ากัน — grant ระดับ user ทำให้เรื่องเก่ามองเห็นอีก
    expect(await findTrackableCase(CODE_A, { channel: 'web' })).not.toBeNull();
  });
});
