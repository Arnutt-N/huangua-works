import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { caseUpdates, cases, categories, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { GET } from './route';

const TEST_USER_EMAIL = 'integration-test-case-detail@placeholder.local';
let testUserId: string;
let testCaseId: string;
let categoryId: string;

function buildRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/cases/test', { method: 'GET' });
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

describe('GET /api/cases/[id]', () => {
  test('returns 200 with the full case shape for an existing case', async () => {
    const res = await GET(buildRequest(), { params: Promise.resolve({ id: testCaseId }) });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.case.id).toBe(testCaseId);
    expect(body.case.status).toBe('in_progress');
    expect(body.category).toMatchObject({ id: categoryId });
    expect(body.submitter).toMatchObject({ fullName: 'ผู้แจ้งทดสอบ Integration' });
    expect(body.assignedOfficer).toBeNull();
  });

  test('only includes public case_updates, not internal ones', async () => {
    const res = await GET(buildRequest(), { params: Promise.resolve({ id: testCaseId }) });
    const body = await res.json();

    expect(body.updates).toHaveLength(1);
    expect(body.updates[0].updateType).toBe('status_change');
  });

  test('returns 404 for a non-existent case id', async () => {
    const res = await GET(buildRequest(), {
      params: Promise.resolve({ id: 'does-not-exist' }),
    });

    expect(res.status).toBe(404);
  });
});
