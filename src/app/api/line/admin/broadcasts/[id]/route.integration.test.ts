import { inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatBroadcastFailedRecipients, chatBroadcasts } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: 'admin-1' }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));

import { GET } from './route';

const ids: string[] = [];

function req(id: string): Request {
  return new Request(`http://localhost:3000/api/line/admin/broadcasts/${id}`);
}

async function seedBroadcast(over: Record<string, unknown> = {}) {
  const db = await getDb();
  const id = generateId();
  await db.insert(chatBroadcasts).values({
    id,
    content: [{ type: 'text', text: 'ประกาศทดสอบ' }],
    status: 'draft',
    target: { kind: 'all' },
    ...over,
  });
  ids.push(id);
  return id;
}

beforeEach(async () => {
  const db = await getDb();
  if (ids.length > 0) {
    await db.delete(chatBroadcastFailedRecipients).where(inArray(chatBroadcastFailedRecipients.broadcastId, ids));
    await db.delete(chatBroadcasts).where(inArray(chatBroadcasts.id, ids));
    ids.length = 0;
  }
});

afterAll(async () => {
  const db = await getDb();
  if (ids.length > 0) {
    await db.delete(chatBroadcastFailedRecipients).where(inArray(chatBroadcastFailedRecipients.broadcastId, ids));
    await db.delete(chatBroadcasts).where(inArray(chatBroadcasts.id, ids));
  }
  await closeDb();
});

describe('GET /broadcasts/[id]', () => {
  test('คืนแถว + จำนวนผู้รับล้มเหลว', async () => {
    const id = await seedBroadcast({ status: 'sent', totalRecipients: 10, successCount: 9, failedCount: 1 });
    const db = await getDb();
    await db.insert(chatBroadcastFailedRecipients).values({ id: generateId(), broadcastId: id, recipientHash: 'h1' });

    const res = await GET(req(id), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(id);
    expect(body.failedRecipients).toBe(1);
  });

  test('ไม่มีแถวคืน 404 ไทย', async () => {
    const res = await GET(req('nope'), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('ไม่พบ broadcast');
  });
});
