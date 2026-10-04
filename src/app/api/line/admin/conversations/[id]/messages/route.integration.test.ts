import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatConversations, chatMessages } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

const mocks = vi.hoisted(() => ({ currentUserId: '' }));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: mocks.currentUserId }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));

vi.mock('@/lib/line/sse/broadcaster', () => ({ broadcast: vi.fn() }));

import { broadcast } from '@/lib/line/sse/broadcaster';
import { POST } from './route';

// stub ที่ขอบ HTTP — ใช้ได้ทั้งโค้ดเดิม (pushMessage ตรง) และหลังย้ายไป httpLineTransport
const fetchMock = vi.fn<typeof fetch>();
let conversationId: string;
let lineUserId: string;

function postRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost:3000/api/line/admin/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function pushBodies(): { to: string; messages: { text: string }[] }[] {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith('/message/push'))
    .map(([, init]) => JSON.parse(String(init?.body)));
}

async function messagesByTempId(tempId: string) {
  const db = await getDb();
  return db.select().from(chatMessages).where(eq(chatMessages.clientTempId, tempId));
}

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock);
  mocks.currentUserId = generateId();
  conversationId = generateId();
  lineUserId = `it-line-reply-${conversationId}`;
  const db = await getDb();
  await db.insert(chatConversations).values({
    id: conversationId,
    lineUserId,
    mode: 'human_active',
    assignedAdminId: mocks.currentUserId,
    unreadAdmin: 2,
  });
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));
  vi.mocked(broadcast).mockClear();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  const db = await getDb();
  await db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId));
  await db.delete(chatConversations).where(eq(chatConversations.id, conversationId));
  await closeDb();
});

describe('POST /api/line/admin/conversations/[id]/messages', () => {
  test('ส่งใหม่: 200 + push ไป LINE + pushStatus=sent + last message เป็น admin + broadcast', async () => {
    const tempId = `tmp-${generateId()}`;
    const res = await POST(postRequest(conversationId, { text: 'รับเรื่องแล้วครับ', clientTempId: tempId }), params(conversationId));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, pushStatus: 'sent' });
    expect(body.duplicate).toBeUndefined();
    expect(pushBodies()).toEqual([{ to: lineUserId, messages: [{ type: 'text', text: 'รับเรื่องแล้วครับ' }] }]);

    const [row] = await messagesByTempId(tempId);
    expect(row).toMatchObject({ id: body.messageId, sender: 'admin', adminUserId: mocks.currentUserId, metadata: { pushStatus: 'sent' } });

    const db = await getDb();
    const [conv] = await db.select().from(chatConversations).where(eq(chatConversations.id, conversationId));
    expect(conv).toMatchObject({ lastMessageText: 'รับเรื่องแล้วครับ', lastMessageSender: 'admin', unreadAdmin: 0 });
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'new_message', conversationId, payload: expect.objectContaining({ id: body.messageId, clientTempId: tempId }) }),
    );
  });

  test('retry tempId เดิมหลังสำเร็จ: 200 duplicate ไม่ push ซ้ำ', async () => {
    const tempId = `tmp-${generateId()}`;
    const first = await (await POST(postRequest(conversationId, { text: 'ซ้ำ', clientTempId: tempId }), params(conversationId))).json();
    fetchMock.mockClear();

    const res = await POST(postRequest(conversationId, { text: 'ซ้ำ', clientTempId: tempId }), params(conversationId));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, messageId: first.messageId, pushStatus: 'sent', duplicate: true });
    expect(pushBodies()).toHaveLength(0);
    expect(await messagesByTempId(tempId)).toHaveLength(1);
  });

  test('LINE ตอบ 500 → 502 pushStatus=failed ไม่ broadcast; retry tempId เดิมสำเร็จ → 200 duplicate', async () => {
    const tempId = `tmp-${generateId()}`;
    fetchMock.mockImplementationOnce(async () => new Response('boom', { status: 500 }));

    const failed = await POST(postRequest(conversationId, { text: 'ลองใหม่', clientTempId: tempId }), params(conversationId));
    expect(failed.status).toBe(502);
    const failedBody = await failed.json();
    expect(failedBody).toMatchObject({ error: 'ส่งข้อความไป LINE ไม่สำเร็จ', pushStatus: 'failed' });
    expect(broadcast).not.toHaveBeenCalled();

    const retried = await POST(postRequest(conversationId, { text: 'ลองใหม่', clientTempId: tempId }), params(conversationId));
    expect(retried.status).toBe(200);
    expect(await retried.json()).toEqual({ ok: true, messageId: failedBody.messageId, pushStatus: 'sent', duplicate: true });
    expect(pushBodies()).toHaveLength(2);
    expect(await messagesByTempId(tempId)).toHaveLength(1);
  });

  test('404 ห้องที่ไม่มี และไม่ยิง LINE', async () => {
    const missing = generateId();
    const res = await POST(postRequest(missing, { text: 'x' }), params(missing));
    expect(res.status).toBe(404);
    expect(pushBodies()).toHaveLength(0);
  });

  test('400 ข้อความว่าง', async () => {
    const res = await POST(postRequest(conversationId, { text: '   ' }), params(conversationId));
    expect(res.status).toBe(400);
  });
});
