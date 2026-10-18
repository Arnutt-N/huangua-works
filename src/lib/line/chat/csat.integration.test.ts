import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatConversations, chatCsatResponses } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { recordCsatResponse } from './csat';

const created: string[] = [];

async function createConv(): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.insert(chatConversations).values({ id, lineUserId: `it-csat-${id}`, mode: 'resolved' });
  created.push(id);
  return id;
}

afterAll(async () => {
  const db = await getDb();
  if (created.length > 0) {
    await db.delete(chatCsatResponses).where(inArray(chatCsatResponses.conversationId, created));
    await db.delete(chatConversations).where(inArray(chatConversations.id, created));
  }
  await closeDb();
});

describe('recordCsatResponse', () => {
  test('บันทึกครั้งแรก → recorded', async () => {
    const conv = await createConv();
    const result = await recordCsatResponse(conv, 5, new Date('2026-10-17T10:00:00Z'));
    expect(result).toEqual({ kind: 'recorded', score: 5 });
  });

  test('กดซ้ำรอบปิดเดิม → duplicate ไม่เพิ่มแถว', async () => {
    const conv = await createConv();
    const cycle = new Date('2026-10-17T10:00:00Z');
    await recordCsatResponse(conv, 4, cycle);
    const again = await recordCsatResponse(conv, 2, cycle);
    expect(again).toEqual({ kind: 'duplicate', score: 4 });

    const db = await getDb();
    const rows = await db
      .select()
      .from(chatCsatResponses)
      .where(eq(chatCsatResponses.conversationId, conv));
    expect(rows).toHaveLength(1);
  });

  test('ปิดรอบใหม่ → โหวตใหม่ได้', async () => {
    const conv = await createConv();
    await recordCsatResponse(conv, 4, new Date('2026-10-17T10:00:00Z'));
    const second = await recordCsatResponse(conv, 5, new Date('2026-10-17T11:00:00Z'));
    expect(second).toEqual({ kind: 'recorded', score: 5 });
  });
});
