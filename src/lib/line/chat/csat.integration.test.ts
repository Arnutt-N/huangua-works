import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatConversations, chatCsatResponses } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { recordCsatResponse } from './csat';

/**
 * Integration — ข้อ 10: กดปุ่มประเมินของรอบเก่าหลังเปิด-ปิดรอบใหม่
 * ต้องไม่เขียนคะแนนให้รอบใหม่ (unique ต่อ (ห้อง, resolvedAt) + roundRef จากปุ่ม)
 */
const RUN = Date.now();
const CONV_ID = `it-csat-${RUN}-conv`;
const ROUND1 = new Date(Date.UTC(2026, 10, 27, 3)); // รอบปิดครั้งแรก
const ROUND2 = new Date(Date.UTC(2026, 10, 28, 3)); // รอบปิดครั้งที่สอง

beforeAll(async () => {
  const db = await getDb();
  await db.insert(chatConversations).values({
    id: CONV_ID,
    lineUserIdHash: `it-csat-${RUN}-hash`,
    resolvedAt: ROUND1,
  }).onConflictDoNothing();
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(chatCsatResponses).where(eq(chatCsatResponses.conversationId, CONV_ID));
  await db.delete(chatConversations).where(eq(chatConversations.id, CONV_ID));
  await closeDb();
});

describe('recordCsatResponse · ผูกกับรอบปิด', () => {
  it('ปุ่มรอบเก่า (roundRef=ROUND1) ไม่กินสิทธิ์ของรอบใหม่ (ROUND2)', async () => {
    const db = await getDb();

    // รอบ 1: ให้คะแนน
    const r1 = await recordCsatResponse(db, CONV_ID, 5, ROUND1);
    expect(r1.kind).toBe('recorded');

    // รอบ 2: ผู้ใช้ให้คะแนนใหม่
    const r2 = await recordCsatResponse(db, CONV_ID, 2, ROUND2);
    expect(r2).toMatchObject({ kind: 'recorded', score: 2 });

    // กดปุ่มเก่าของรอบ 1 อีกครั้ง → ชนของรอบ 1 (duplicate) ไม่เขียนทับรอบ 2
    const old = await recordCsatResponse(db, CONV_ID, 1, ROUND1);
    expect(old).toMatchObject({ kind: 'duplicate', score: 5 });

    const rows = await db
      .select({ resolvedAt: chatCsatResponses.resolvedAt, score: chatCsatResponses.score })
      .from(chatCsatResponses)
      .where(inArray(chatCsatResponses.conversationId, [CONV_ID]));
    expect(rows).toHaveLength(2);
    const byRound = new Map(rows.map((r) => [r.resolvedAt!.getTime(), r.score]));
    expect(byRound.get(ROUND1.getTime())).toBe(5);
    expect(byRound.get(ROUND2.getTime())).toBe(2);
  });
});
