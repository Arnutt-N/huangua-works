import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatAdminPrefs, chatConversations, users } from '@/lib/db/schema';
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

import { PUT } from './route';

let adminId: string;
let conversationId: string;

function putRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost:3000/api/line/admin/conversations/${id}/prefs`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  const db = await getDb();

  adminId = generateId();
  await db.insert(users).values({
    id: adminId,
    email: `it-chat-prefs-${adminId}@placeholder.local`,
    role: 'officer',
    isActive: true,
    fullName: 'แอดมินทดสอบ prefs',
  });

  conversationId = generateId();
  await db.insert(chatConversations).values({
    id: conversationId,
    lineUserId: `it-line-prefs-${conversationId}`,
    mode: 'bot_active',
  });

  mocks.currentUserId = adminId;
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(chatAdminPrefs).where(eq(chatAdminPrefs.conversationId, conversationId));
  await db.delete(chatConversations).where(eq(chatConversations.id, conversationId));
  await db.delete(users).where(eq(users.id, adminId));
  await closeDb();
});

async function readPref() {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(chatAdminPrefs)
    .where(
      and(
        eq(chatAdminPrefs.adminUserId, adminId),
        eq(chatAdminPrefs.conversationId, conversationId),
      ),
    );
  if (!row) throw new Error('pref row หายจาก DB ระหว่างเทสต์');
  return row;
}

describe('PUT /api/line/admin/conversations/[id]/prefs — upsert', () => {
  test('first call inserts a pref row', async () => {
    const res = await PUT(putRequest(conversationId, { pinned: true }), params(conversationId));
    expect(res.status).toBe(200);

    const pref = await readPref();
    expect(pref.pinned).toBe(true);
    expect(pref.muted).toBe(false);
  });

  test('second call updates only the provided field (no row duplication)', async () => {
    const res = await PUT(putRequest(conversationId, { muted: true }), params(conversationId));
    expect(res.status).toBe(200);

    const db = await getDb();
    const rows = await db
      .select()
      .from(chatAdminPrefs)
      .where(
        and(
          eq(chatAdminPrefs.adminUserId, adminId),
          eq(chatAdminPrefs.conversationId, conversationId),
        ),
      );
    expect(rows).toHaveLength(1);
    // pinned จากรอบแรกต้องไม่ถูกทับ
    expect(rows[0]).toMatchObject({ pinned: true, muted: true });
  });

  test('can toggle back off', async () => {
    const res = await PUT(
      putRequest(conversationId, { pinned: false, muted: false }),
      params(conversationId),
    );
    expect(res.status).toBe(200);

    const pref = await readPref();
    expect(pref.pinned).toBe(false);
    expect(pref.muted).toBe(false);
  });

  test('400 when body has neither pinned nor muted', async () => {
    const res = await PUT(putRequest(conversationId, {}), params(conversationId));
    expect(res.status).toBe(400);
  });
});
