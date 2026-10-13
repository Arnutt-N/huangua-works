import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { cases, caseFeedback } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

vi.mock('@/lib/rate-limit/enforce', () => ({
  enforceRateLimit: vi.fn(async () => ({ allowed: true, reset: 0 })),
}));

import { POST } from './route';

const createdIds: string[] = [];

async function seedCase(status: 'closed' | 'in_progress' = 'closed') {
  const db = await getDb();
  const id = generateId();
  const trackingCode = `HG${Date.now().toString().slice(-6)}${id.slice(0, 2).toUpperCase()}`;
  await db.insert(cases).values({
    id,
    status,
    trackingCode,
    categoryId: 'test-category',
    submittedBy: 'test-citizen',
    title: `ทดสอบ feedback ${id}`,
    description: 'integration test',
    location: 'ตำบลหัวงัว',
  });
  createdIds.push(id);
  return { id, trackingCode };
}

function postRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

afterAll(async () => {
  const db = await getDb();
  if (createdIds.length > 0) {
    await db.delete(caseFeedback).where(inArray(caseFeedback.caseId, createdIds));
    await db.delete(cases).where(inArray(cases.id, createdIds));
  }
  await closeDb();
});

describe('POST /api/feedback', () => {
  test('เคสปิดแล้ว + ดาว 5 → 201', async () => {
    const { trackingCode } = await seedCase('closed');
    const res = await POST(postRequest({ trackingCode, rating: 5 }));
    expect(res.status).toBe(201);
  });

  test('ดาวเกิน 1-5 → 400', async () => {
    const { trackingCode } = await seedCase('closed');
    const res = await POST(postRequest({ trackingCode, rating: 9 }));
    expect(res.status).toBe(400);
  });

  test('เคสยังไม่ปิด → 422', async () => {
    const { trackingCode } = await seedCase('in_progress');
    const res = await POST(postRequest({ trackingCode, rating: 4 }));
    expect(res.status).toBe(422);
  });

  test('ให้ซ้ำสองครั้ง → 409', async () => {
    const { trackingCode } = await seedCase('closed');
    expect((await POST(postRequest({ trackingCode, rating: 5 }))).status).toBe(201);
    expect((await POST(postRequest({ trackingCode, rating: 3 }))).status).toBe(409);
  });

  test('เลขติดตามไม่มี → 404', async () => {
    const res = await POST(postRequest({ trackingCode: 'HGXXXXXX', rating: 5 }));
    expect(res.status).toBe(404);
  });
});
