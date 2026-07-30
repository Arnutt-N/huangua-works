import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatConversations, chatMessages, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

const mocks = vi.hoisted(() => ({ currentUserId: '' }));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: {
      user: { id: mocks.currentUserId },
      ipAddress: '127.0.0.1',
      userAgent: undefined,
    },
  })),
}));

vi.mock('@/lib/line/sse/broadcaster', () => ({ broadcast: vi.fn() }));

import { GET, PATCH } from './route';

let adminAId: string;
let adminBId: string;
let conversationId: string;
let messageIds: string[] = [];

function getRequest(id: string, query = ''): Request {
  return new Request(`http://localhost:3000/api/line/admin/conversations/${id}${query}`);
}

function patchRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost:3000/api/line/admin/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function loadConv() {
  const db = await getDb();
  const [conv] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, conversationId));
  if (!conv) throw new Error('conversation หายจาก DB ระหว่างเทสต์');
  return conv;
}

beforeAll(async () => {
  const db = await getDb();

  adminAId = generateId();
  adminBId = generateId();
  await db.insert(users).values([
    {
      id: adminAId,
      email: `it-chat-admin-a-${adminAId}@placeholder.local`,
      role: 'officer',
      isActive: true,
      fullName: 'แอดมิน A ทดสอบ',
    },
    {
      id: adminBId,
      email: `it-chat-admin-b-${adminBId}@placeholder.local`,
      role: 'officer',
      isActive: true,
      fullName: 'แอดมิน B ทดสอบ',
    },
  ]);

  conversationId = generateId();
  await db.insert(chatConversations).values({
    id: conversationId,
    lineUserId: `it-line-${conversationId}`,
    mode: 'bot_active',
  });

  // UUIDv7 เรียงตามเวลา — สร้างตามลำดับให้ cursor paging ตรวจได้
  messageIds = [];
  for (let i = 1; i <= 5; i++) {
    const id = generateId();
    messageIds.push(id);
    await db.insert(chatMessages).values({
      id,
      conversationId,
      sender: i % 2 === 0 ? 'admin' : 'user',
      messageType: 'text',
      textContent: `ข้อความทดสอบ ${i}`,
    });
  }

  mocks.currentUserId = adminAId;
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId));
  await db.delete(chatConversations).where(eq(chatConversations.id, conversationId));
  await db.delete(users).where(eq(users.id, adminAId));
  await db.delete(users).where(eq(users.id, adminBId));
  await closeDb();
});

describe('GET /api/line/admin/conversations/[id] — cursor paging', () => {
  test('first page returns newest messages asc with hasMore', async () => {
    const res = await GET(getRequest(conversationId, '?limit=2'), params(conversationId));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.conversation.id).toBe(conversationId);
    expect(body.hasMore).toBe(true);
    expect(body.messages.map((m: { id: string }) => m.id)).toEqual([
      messageIds[3],
      messageIds[4],
    ]);
  });

  test('before cursor walks backwards; last page has hasMore=false', async () => {
    const res2 = await GET(
      getRequest(conversationId, `?limit=2&before=${messageIds[3]}`),
      params(conversationId),
    );
    const page2 = await res2.json();
    expect(page2.messages.map((m: { id: string }) => m.id)).toEqual([
      messageIds[1],
      messageIds[2],
    ]);
    expect(page2.hasMore).toBe(true);

    const res3 = await GET(
      getRequest(conversationId, `?limit=2&before=${messageIds[1]}`),
      params(conversationId),
    );
    const page3 = await res3.json();
    expect(page3.messages.map((m: { id: string }) => m.id)).toEqual([messageIds[0]]);
    expect(page3.hasMore).toBe(false);
  });

  test('404 for unknown conversation', async () => {
    const missing = generateId();
    const res = await GET(getRequest(missing), params(missing));
    expect(res.status).toBe(404);
  });
});

describe('PATCH — atomic claim', () => {
  test('first claim wins, second admin gets 409, same admin idempotent', async () => {
    mocks.currentUserId = adminAId;
    const res = await PATCH(
      patchRequest(conversationId, { mode: 'human_active' }),
      params(conversationId),
    );
    expect(res.status).toBe(200);

    const conv = await loadConv();
    expect(conv.mode).toBe('human_active');
    expect(conv.assignedAdminId).toBe(adminAId);

    // แอดมินคนละคน claim ซ้ำ → 409
    mocks.currentUserId = adminBId;
    const conflict = await PATCH(
      patchRequest(conversationId, { mode: 'human_active' }),
      params(conversationId),
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toBe('มีเจ้าหน้าที่รับเรื่องนี้แล้ว');

    // แอดมินเดิม claim ซ้ำ → idempotent ok
    mocks.currentUserId = adminAId;
    const idem = await PATCH(
      patchRequest(conversationId, { mode: 'human_active' }),
      params(conversationId),
    );
    expect(idem.status).toBe(200);
  });
});

describe('PATCH — transfer', () => {
  test('transfers a human_active room and appends metadata.transfers audit', async () => {
    mocks.currentUserId = adminAId;
    const res = await PATCH(
      patchRequest(conversationId, {
        assignedAdminId: adminBId,
        transferReason: 'ทดสอบโอนเวร',
      }),
      params(conversationId),
    );
    expect(res.status).toBe(200);

    const conv = await loadConv();
    expect(conv.assignedAdminId).toBe(adminBId);
    const transfers = (conv.metadata as { transfers?: unknown[] })?.transfers;
    expect(transfers).toHaveLength(1);
    expect(transfers?.[0]).toMatchObject({
      toAdminId: adminBId,
      byAdminId: adminAId,
      reason: 'ทดสอบโอนเวร',
    });
  });

  test('409 when the room is not human_active', async () => {
    const db = await getDb();
    await db
      .update(chatConversations)
      .set({ mode: 'resolved' })
      .where(eq(chatConversations.id, conversationId));

    const res = await PATCH(
      patchRequest(conversationId, { assignedAdminId: adminAId }),
      params(conversationId),
    );
    expect(res.status).toBe(409);

    // คืน state ให้เทสต์อื่น
    await db
      .update(chatConversations)
      .set({ mode: 'human_active' })
      .where(eq(chatConversations.id, conversationId));
  });

  test('404 for unknown conversation', async () => {
    const missing = generateId();
    const res = await PATCH(patchRequest(missing, { assignedAdminId: adminAId }), params(missing));
    expect(res.status).toBe(404);
  });
});

describe('PATCH — admin note', () => {
  test('saves note with updatedBy/At, no mode change', async () => {
    mocks.currentUserId = adminBId;
    const res = await PATCH(
      patchRequest(conversationId, { adminNote: 'ลูกค้าชอบให้โทรกลับช่วงเย็น' }),
      params(conversationId),
    );
    expect(res.status).toBe(200);

    const conv = await loadConv();
    expect(conv.adminNote).toBe('ลูกค้าชอบให้โทรกลับช่วงเย็น');
    expect(conv.adminNoteUpdatedBy).toBe(adminBId);
    expect(conv.adminNoteUpdatedAt).toBeInstanceOf(Date);
    expect(conv.mode).toBe('human_active');
  });

  test('null clears the note', async () => {
    const res = await PATCH(
      patchRequest(conversationId, { adminNote: null }),
      params(conversationId),
    );
    expect(res.status).toBe(200);

    const conv = await loadConv();
    expect(conv.adminNote).toBeNull();
  });
});
