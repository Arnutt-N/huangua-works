import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { lineWebhookEvents } from '@/lib/db/schema';
import { GET } from '@/app/api/cron/ping/route';
import {
  BarrierDeferred,
  claimNextWebhookEvent,
  commitEffects,
  enqueueWebhookEvent,
  markFailed,
} from '../webhook-events';
import { createRecordingTransport } from '../conversation/recording-transport';
import { processWebhookEvents } from './engine';
import type { LineWebhookEvent } from '../types';

// § ต้องมี docker compose up -d postgres redis up-redis + .env.local ก่อนรัน
vi.setConfig({ testTimeout: 30_000 });

type EventRow = typeof lineWebhookEvents.$inferSelect;
let snapshot: EventRow[] = [];

beforeAll(async () => {
  const db = await getDb();
  snapshot = await db.select().from(lineWebhookEvents);
  await db.delete(lineWebhookEvents);
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(lineWebhookEvents);
  if (snapshot.length > 0) await db.insert(lineWebhookEvents).values(snapshot);
  await closeDb();
});

let seq = 0;
function messageEvent(userId: string, timestamp: number): LineWebhookEvent {
  seq++;
  return {
    type: 'message',
    replyToken: `reply-${seq}`,
    timestamp,
    mode: 'active',
    webhookEventId: `it-webhook-${Date.now()}-${seq}`,
    source: { type: 'user', userId },
    message: { type: 'text', id: `it-msg-${Date.now()}-${seq}`, text: 'สวัสดี' },
  } as LineWebhookEvent;
}

async function insertRaw(overrides: Partial<EventRow> & { dedupKey: string; lineUserIdHash: string }): Promise<EventRow> {
  const db = await getDb();
  const [row] = await db.insert(lineWebhookEvents).values({
    id: `it-${overrides.dedupKey}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    eventType: 'message',
    eventTimestamp: 1000,
    payload: {},
    ...overrides,
  }).returning();
  return row!;
}

async function rowOf(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(lineWebhookEvents)
    .where(eq(lineWebhookEvents.id, id)).limit(1);
  return row!;
}

describe('durable LINE webhook events · integration', () => {
  test('failure ก่อน inbound → แถวยัง pending และไม่มี effects committed', async () => {
    const event = messageEvent('U-before', 1000);
    const { id } = await enqueueWebhookEvent(event);
    expect(id).toBeTruthy();

    await markFailed(id!, 1);
    const row = await rowOf(id!);
    expect(row.status).toBe('pending');
    expect(row.effectsCommittedAt).toBeNull();
    expect(row.pendingReplies).toBeNull();
  });

  test('retry ไม่ duplicate inbound — ON CONFLICT DO NOTHING', async () => {
    const event = messageEvent('U-dedup', 2000);
    const first = await enqueueWebhookEvent(event);
    const second = await enqueueWebhookEvent(event);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.id).toBeUndefined();

    const db = await getDb();
    const rows = await db.select().from(lineWebhookEvents)
      .where(eq(lineWebhookEvents.dedupKey, `w:${event.webhookEventId}`));
    expect(rows).toHaveLength(1);
  });

  test('failure หลัง effects commit → pendingReplies อยู่, retry ส่ง reply โดยไม่ทำ effects ซ้ำ', async () => {
    const event = messageEvent('U-after', 3000);
    const { id } = await enqueueWebhookEvent(event);
    const db = await getDb();
    await db.update(lineWebhookEvents)
      .set({ status: 'processing', leaseUntil: new Date(Date.now() + 60_000), attempts: 1 })
      .where(eq(lineWebhookEvents.id, id!));
    const [claimed] = await db.select().from(lineWebhookEvents).where(eq(lineWebhookEvents.id, id!)).limit(1);
    const replies = [{ type: 'text' as const, text: 'ตอบแล้ว' }];

    await db.transaction(async (tx) => {
      const result = await commitEffects(tx, claimed as never, async () => ({ replies }));
      expect(result?.replies).toEqual(replies);
    });

    // § reply พัง → ยังอยู่ processing + pendingReplies อยู่ (retry ต้องไม่ทำ effects ซ้ำ)
    const before = await rowOf(id!);
    expect(before.status).toBe('processing');
    expect(before.effectsCommittedAt).not.toBeNull();
    expect(before.pendingReplies).toEqual(replies);

    // § หมด lease + พ้น backoff แล้วให้ recovery หยิบ retry — คราวนี้ reply สำเร็จ
    await db.update(lineWebhookEvents)
      .set({
        leaseUntil: new Date(Date.now() - 1000),
        updatedAt: new Date(Date.now() - 5000),
      })
      .where(eq(lineWebhookEvents.id, id!));
    const transport = createRecordingTransport();
    const outcome = await processWebhookEvents(50, transport);
    expect(outcome.done).toBeGreaterThanOrEqual(1);

    const after = await rowOf(id!);
    expect(after.status).toBe('done');
    expect(after.pendingReplies).toBeNull();
    expect(transport.calls.filter((c) => c.kind === 'reply'
      && c.messages.some((m) => m.type === 'text' && m.text === 'ตอบแล้ว'))).toHaveLength(1);
  });

  test('barrier: message กับ postback ของ user เดียว — ตัวหลังรอจนตัวแรก commit', async () => {
    const db = await getDb();
    const hash = `barrier-user-${Date.now()}`;
    const earlier = await insertRaw({
      dedupKey: `barrier-${Date.now()}-1`,
      lineUserIdHash: hash,
      eventTimestamp: 1000,
      status: 'processing',
      effectsCommittedAt: null,
    });
    const later = await insertRaw({
      dedupKey: `barrier-${Date.now()}-2`,
      lineUserIdHash: hash,
      eventTimestamp: 2000,
      status: 'processing',
      effectsCommittedAt: null,
    });

    let effectsCalled = false;
    await expect(db.transaction(async (tx) =>
      commitEffects(tx, later as never, async () => {
        effectsCalled = true;
        return { replies: [] };
      }),
    )).rejects.toBeInstanceOf(BarrierDeferred);
    expect(effectsCalled).toBe(false);

    // § commit event ก่อน แล้ว event หลังถึงได้ committed step ของตัวเอง
    await db.transaction(async (tx) => {
      await commitEffects(tx, earlier as never, async () => ({ replies: [] }));
    });
    await db.transaction(async (tx) => {
      const result = await commitEffects(tx, later as never, async () => ({ replies: [] }));
      expect(result).not.toBeNull();
    });
  });

  test('recovery auth + bounded attempts', async () => {
    const unauthorized = await GET(new NextRequest('http://localhost/api/cron/ping'));
    expect(unauthorized.status).toBe(401);

    const res = await GET(new NextRequest('http://localhost/api/cron/ping', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { recovery: { attempted: number; done: number } };
    expect(json.recovery.attempted).toBeLessThanOrEqual(20);

    const row = await insertRaw({
      dedupKey: `terminal-${Date.now()}`,
      lineUserIdHash: 'terminal-user',
      status: 'processing',
      attempts: 4,
    });
    await markFailed(row.id, 5);
    expect((await rowOf(row.id)).status).toBe('failed');
  });

  test('claim เลือกตาม timestamp แล้ว id', async () => {
    const hash = `order-${Date.now()}`;
    const first = await insertRaw({
      dedupKey: `order-a-${Date.now()}`,
      lineUserIdHash: hash,
      eventTimestamp: 1000,
    });
    const second = await insertRaw({
      dedupKey: `order-b-${Date.now()}`,
      lineUserIdHash: hash,
      eventTimestamp: 2000,
    });
    const [claimed] = await claimNextWebhookEvent(1);
    expect(claimed?.id).toBe(first.id);
    expect(second.id).not.toBe(claimed?.id);
  });

  test('batch store อีก event เมื่อตัวหนึ่ง insert ไม่ได้ (dedupKey ซ้ำ)', async () => {
    const first = messageEvent('U-batch', 5000);
    const stored = await enqueueWebhookEvent(first);
    const dup = { ...first, message: { type: 'text' as const, id: 'different-message', text: 'อื่น' } };
    const [a, b] = await Promise.all([
      enqueueWebhookEvent(dup),
      enqueueWebhookEvent(messageEvent('U-batch-2', 6000)),
    ]);
    expect(a.ok).toBe(true);
    expect(a.id).toBeUndefined();
    expect(b.ok).toBe(true);
    expect(b.id).toBeTruthy();
    expect(stored.id).toBeTruthy();
  });
});
