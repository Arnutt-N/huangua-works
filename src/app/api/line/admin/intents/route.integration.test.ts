import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatIntentKeywords, chatIntents } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: 'it-intents-admin' }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));
// § ตัด audit ออก — ไฟล์นี้ทดสอบการ map ผลของ intent-store เป็น HTTP ไม่ใช่ audit
vi.mock('@/lib/audit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/audit')>()),
  logAudit: vi.fn(async () => {}),
}));

import { POST } from './route';
import { DELETE, PATCH } from './[id]/route';

const RUN = generateId();
const createdIds: string[] = [];

function jsonRequest(method: string, body: unknown): Request {
  return new Request('http://localhost:3000/api/line/admin/intents', {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function createViaApi(label: string): Promise<string> {
  const res = await POST(
    jsonRequest('POST', {
      name: `it-route-intent-${label}-${RUN}`,
      keywords: [{ keyword: `it-route-kw-${label}-${RUN}`, matchType: 'exact' }],
      responses: [{ replyType: 'text', textContent: 'ทดสอบ' }],
    }),
  );
  expect(res.status).toBe(201);
  const { id } = (await res.json()) as { id: string };
  createdIds.push(id);
  return id;
}

afterAll(async () => {
  const db = await getDb();
  if (createdIds.length > 0) await db.delete(chatIntents).where(inArray(chatIntents.id, createdIds));
  await closeDb();
});

describe('POST /api/line/admin/intents', () => {
  test('201 + id', async () => {
    const id = await createViaApi('post');
    expect(id).toBeTruthy();
  });

  test('400 เมื่อ regex ไม่ถูกต้อง', async () => {
    const res = await POST(
      jsonRequest('POST', {
        name: `it-route-intent-bad-${RUN}`,
        keywords: [{ keyword: '(', matchType: 'regex' }],
        responses: [{ replyType: 'text', textContent: 'x' }],
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('regex ไม่ถูกต้อง');
  });
});

describe('PATCH /api/line/admin/intents/[id]', () => {
  test('404 เมื่อไม่พบ', async () => {
    const res = await PATCH(jsonRequest('PATCH', { isActive: false }), params(`ไม่มีอยู่จริง-${RUN}`));
    expect(res.status).toBe(404);
  });

  test('400 เมื่อ regex ไม่ถูกต้อง', async () => {
    const id = await createViaApi('patch-bad');
    const res = await PATCH(
      jsonRequest('PATCH', { keywords: [{ keyword: '[', matchType: 'regex' }] }),
      params(id),
    );
    expect(res.status).toBe(400);
  });

  test('200 และแทนที่ keywords', async () => {
    const id = await createViaApi('patch-ok');
    const res = await PATCH(
      jsonRequest('PATCH', { keywords: [{ keyword: `it-route-kw-new-${RUN}`, matchType: 'exact' }] }),
      params(id),
    );
    expect(res.status).toBe(200);

    const db = await getDb();
    const rows = await db
      .select({ keyword: chatIntentKeywords.keyword })
      .from(chatIntentKeywords)
      .where(eq(chatIntentKeywords.intentId, id));
    expect(rows.map((r) => r.keyword)).toEqual([`it-route-kw-new-${RUN}`]);
  });
});

describe('DELETE /api/line/admin/intents/[id]', () => {
  test('200 แล้วลบซ้ำได้ 404', async () => {
    const id = await createViaApi('delete');
    const first = await DELETE(jsonRequest('DELETE', {}), params(id));
    expect(first.status).toBe(200);
    const second = await DELETE(jsonRequest('DELETE', {}), params(id));
    expect(second.status).toBe(404);
  });
});
