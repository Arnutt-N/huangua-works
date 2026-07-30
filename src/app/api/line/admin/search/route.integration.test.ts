import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatConversations, chatMessages } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: {
      user: { id: 'it-search-admin' },
      ipAddress: '127.0.0.1',
      userAgent: undefined,
    },
  })),
}));

import { GET } from './route';

let conversationId: string;
// marker เฉพาะรอบรัน — กันชนกับข้อมูลอื่นใน DB dev
const MARKER = `itsearch${generateId().slice(-8)}`;

function searchRequest(q: string): Request {
  return new Request(
    `http://localhost:3000/api/line/admin/search?q=${encodeURIComponent(q)}`,
  );
}

beforeAll(async () => {
  const db = await getDb();

  conversationId = generateId();
  await db.insert(chatConversations).values({
    id: conversationId,
    lineUserId: `it-line-search-${conversationId}`,
    mode: 'bot_active',
  });

  await db.insert(chatMessages).values([
    {
      id: generateId(),
      conversationId,
      sender: 'user',
      messageType: 'text',
      textContent: `ถนนหน้าบ้านชำรุด ${MARKER}`,
    },
    {
      id: generateId(),
      conversationId,
      sender: 'admin',
      messageType: 'text',
      textContent: `100% เสร็จแน่นอน ${MARKER}`,
    },
    {
      id: generateId(),
      conversationId,
      sender: 'user',
      messageType: 'text',
      textContent: `ราคา 100 บาท ${MARKER}`,
    },
  ]);
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId));
  await db.delete(chatConversations).where(eq(chatConversations.id, conversationId));
  await closeDb();
});

describe('GET /api/line/admin/search — ILIKE + escaping', () => {
  test('finds messages case-insensitively by substring', async () => {
    const res = await GET(searchRequest(MARKER.toUpperCase()));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.items.length).toBe(3);
    expect(body.items[0]).toMatchObject({ conversationId });
    expect(body.items[0].snippet.length).toBeLessThanOrEqual(120);
  });

  test('escapes % so it matches literally, not as wildcard', async () => {
    // "100%" ถ้าไม่ escape จะ match "100 บาท" ด้วย (% = wildcard)
    const res = await GET(searchRequest(`100% เสร็จ`));
    const body = await res.json();

    expect(body.items).toHaveLength(1);
    expect(body.items[0].snippet).toContain('100% เสร็จแน่นอน');
  });

  test('escapes _ so it does not match any-single-char', async () => {
    // "100_" ต้องไม่ match "100%" หรือ "100 " (_ = any single char)
    const res = await GET(searchRequest(`100_เสร็จ`));
    const body = await res.json();
    expect(body.items).toHaveLength(0);
  });

  test('400 for empty query', async () => {
    const res = await GET(searchRequest(''));
    expect(res.status).toBe(400);
  });
});
