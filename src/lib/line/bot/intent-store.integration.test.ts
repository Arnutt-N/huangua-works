import { eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatIntentKeywords, chatIntentResponses, chatIntents } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { readConfigVersion } from '../config-version';
import { matchIntent } from './intent-matcher';
import { createIntent, deleteIntent, updateIntent, type CreateIntentInput } from './intent-store';

/**
 * Integration — ต้องมี `docker compose up -d postgres redis up-redis`
 * keyword ทุกตัวมี RUN ต่อท้าย (match แบบ exact) จึงไม่ชนกับ intents จริงใน dev DB
 */

const RUN = generateId();
const createdIds: string[] = [];
const isolatedDbClosers: Array<() => Promise<void>> = [];

function input(label: string): CreateIntentInput {
  return {
    name: `it-intent-${label}-${RUN}`,
    description: null,
    isActive: true,
    keywords: [{ keyword: `it-kw-${label}-${RUN}`, matchType: 'exact' }],
    responses: [{ replyType: 'text', textContent: `คำตอบ ${label}`, displayOrder: 0 }],
  };
}

async function create(label: string): Promise<string> {
  const result = await createIntent(input(label));
  if (!result.ok) throw new Error(`สร้าง intent ไม่สำเร็จ: ${result.reason}`);
  createdIds.push(result.id);
  return result.id;
}

async function keywordsOf(intentId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ keyword: chatIntentKeywords.keyword })
    .from(chatIntentKeywords)
    .where(eq(chatIntentKeywords.intentId, intentId));
  return rows.map((row) => row.keyword);
}

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  const db = await getDb();
  if (createdIds.length > 0) await db.delete(chatIntents).where(inArray(chatIntents.id, createdIds));
  await Promise.all(isolatedDbClosers.map((close) => close()));
  await closeDb();
});

describe('createIntent', () => {
  test('บันทึก intent + keywords + responses และ bump version', async () => {
    const before = Number((await readConfigVersion('intents')) ?? '0');
    const id = await create('create');

    expect(await keywordsOf(id)).toEqual([`it-kw-create-${RUN}`]);
    const db = await getDb();
    const responses = await db.select().from(chatIntentResponses).where(eq(chatIntentResponses.intentId, id));
    expect(responses).toHaveLength(1);
    // ไม่ assert +1 พอดี — intents/route.integration.test.ts รันขนานและ bump scope เดียวกัน
    expect(Number(await readConfigVersion('intents'))).toBeGreaterThan(before);
  });

  test('regex ไม่ถูกต้อง → invalid_regex และไม่มีแถวถูกสร้าง', async () => {
    const bad = { ...input('bad-regex'), keywords: [{ keyword: '(', matchType: 'regex' as const }] };
    const result = await createIntent(bad);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_regex' });

    const db = await getDb();
    const rows = await db.select().from(chatIntents).where(eq(chatIntents.name, bad.name));
    expect(rows).toHaveLength(0);
  });
});

describe('updateIntent', () => {
  test('ไม่พบ id → not_found', async () => {
    await expect(updateIntent(`ไม่มีอยู่จริง-${RUN}`, { isActive: false })).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  test('§ insert responses พัง → keywords ต้องไม่ถูกแทนที่ (ทั้งก้อนอยู่ใน transaction)', async () => {
    const id = await create('atomic');

    // replyObjectId ที่ไม่มีจริงชน FK chat_intent_responses.reply_object_id → insert ล้ม
    // หลังจากที่ลบ+ใส่ keywords ใหม่ไปแล้วในลำดับการทำงาน
    await expect(
      updateIntent(id, {
        keywords: [{ keyword: `it-kw-atomic-new-${RUN}`, matchType: 'exact' }],
        responses: [{ replyType: 'reply_object', replyObjectId: `ไม่มีอยู่จริง-${RUN}`, displayOrder: 0 }],
      }),
    ).rejects.toThrow();

    expect(await keywordsOf(id)).toEqual([`it-kw-atomic-${RUN}`]);
  });

  test('แทนที่ keywords แล้ว matchIntent ใน process เดียวกันเห็นทันที', async () => {
    const id = await create('replace');
    expect((await matchIntent(`it-kw-replace-${RUN}`))?.intentId).toBe(id);

    const result = await updateIntent(id, {
      keywords: [{ keyword: `it-kw-replace-new-${RUN}`, matchType: 'exact' }],
    });
    expect(result).toEqual({ ok: true, id });

    expect(await matchIntent(`it-kw-replace-${RUN}`)).toBeNull();
    expect((await matchIntent(`it-kw-replace-new-${RUN}`))?.intentId).toBe(id);
  });

  test('อีก process (webhook) เห็น keyword ใหม่ภายในไม่กี่วินาที โดยไม่มีใครเรียก invalidate', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const id = await create('cross');

    vi.resetModules();
    const webhookMatcher = await import('./intent-matcher');
    const webhookDb = await import('@/lib/db');
    isolatedDbClosers.push(webhookDb.closeDb);

    expect((await webhookMatcher.matchIntent(`it-kw-cross-${RUN}`))?.intentId).toBe(id); // อุ่น cache

    await updateIntent(id, { keywords: [{ keyword: `it-kw-cross-new-${RUN}`, matchType: 'exact' }] });
    expect(await webhookMatcher.matchIntent(`it-kw-cross-new-${RUN}`)).toBeNull(); // ยังอยู่ในรอบ 3 วินาที

    vi.setSystemTime(Date.now() + 3_500);
    expect((await webhookMatcher.matchIntent(`it-kw-cross-new-${RUN}`))?.intentId).toBe(id);
  });
});

describe('deleteIntent', () => {
  test('ลบแล้ว keywords หายตาม (cascade) และลบซ้ำได้ not_found', async () => {
    const id = await create('delete');
    await expect(deleteIntent(id)).resolves.toEqual({ ok: true, id });
    expect(await keywordsOf(id)).toEqual([]);
    await expect(deleteIntent(id)).resolves.toEqual({ ok: false, reason: 'not_found' });
  });
});
