import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { caseUpdates, cases, categories, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { GET } from './route';

const TEST_USER_EMAIL = 'integration-test-case-detail@placeholder.local';
const TEST_TRACKING_CODE = 'HN999999991'; // fixed code เพื่อให้ assertion ตรงได้
let testUserId: string;
let testCaseId: string;
let categoryId: string;

function buildRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/cases/${id}`, { method: 'GET' });
}

beforeAll(async () => {
  const db = await getDb();

  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน `pnpm db:seed` ก่อน');
  categoryId = category.id;

  testUserId = generateId();
  await db.insert(users).values({
    id: testUserId,
    email: TEST_USER_EMAIL,
    role: 'citizen',
    isActive: true,
    fullName: 'ผู้แจ้งทดสอบ Integration',
  });

  testCaseId = generateId();
  await db.insert(cases).values({
    id: testCaseId,
    status: 'in_progress',
    priority: 'normal',
    title: 'เคสทดสอบ GET /api/cases/[id]',
    description: 'รายละเอียดทดสอบ',
    location: 'ทดสอบ ตำบลหัวงัว',
    categoryId,
    submittedBy: testUserId,
    trackingCode: TEST_TRACKING_CODE,
  });

  await db.insert(caseUpdates).values([
    {
      id: generateId(),
      caseId: testCaseId,
      userId: testUserId,
      updateType: 'status_change',
      oldValue: 'received',
      newValue: 'in_progress',
      isPublic: true,
    },
    {
      id: generateId(),
      caseId: testCaseId,
      userId: testUserId,
      updateType: 'comment',
      comment: 'บันทึกภายใน ไม่แสดงให้ประชาชนเห็น',
      isPublic: false,
    },
  ]);
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(caseUpdates).where(eq(caseUpdates.caseId, testCaseId));
  await db.delete(cases).where(eq(cases.id, testCaseId));
  await db.delete(users).where(eq(users.id, testUserId));
  await closeDb();
});

describe('GET /api/cases/[id] (lookup via trackingCode)', () => {
  test('returns 200 with PII-stripped shape for a valid tracking code', async () => {
    const res = await GET(buildRequest(TEST_TRACKING_CODE), {
      params: Promise.resolve({ id: TEST_TRACKING_CODE }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.case.status).toBe('in_progress');
    expect(body.case.title).toBe('เคสทดสอบ GET /api/cases/[id]');
    expect(body.category).toMatchObject({ id: categoryId });

    // § PII ถูกถอดออกทั้งหมด
    expect(body.submitter).toBeUndefined();
    expect(body.assignedOfficer).toBeUndefined();
    expect(body.case.description).toBeUndefined();
    expect(body.case.location).toBeUndefined();
    expect(body.case.attachments).toBeUndefined();
    expect(body.department).toBeUndefined();
  });

  test('only includes public case_updates, not internal ones', async () => {
    const res = await GET(buildRequest(TEST_TRACKING_CODE), {
      params: Promise.resolve({ id: TEST_TRACKING_CODE }),
    });
    const body = await res.json();

    expect(body.updates).toHaveLength(1);
    expect(body.updates[0].updateType).toBe('status_change');
  });

  test('returns 404 for a non-existent tracking code', async () => {
    const res = await GET(buildRequest('HN000000000'), {
      params: Promise.resolve({ id: 'HN000000000' }),
    });

    expect(res.status).toBe(404);
  });

  test('returns 404 for malformed input (not HN + 9 digits)', async () => {
    // UUID รูปแบบเก่า — ต้อง 404 ไม่ใช่ lookup ด้วย PK
    const res = await GET(buildRequest('019f5c00-932f-776b-9203-ac13c48c2937'), {
      params: Promise.resolve({ id: '019f5c00-932f-776b-9203-ac13c48c2937' }),
    });

    expect(res.status).toBe(404);
  });
});
