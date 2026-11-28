import { eq, inArray, sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { lineUsers, lineWebhookEvents } from '@/lib/db/schema';
import { GET } from '@/app/api/cron/ping/route';
import {
  BarrierDeferred,
  claimNextWebhookEvent,
  commitEffects,
  enqueueWebhookEvent,
  markFailed,
  restoreEvent,
  cleanupWebhookEvents,
  WEBHOOK_RETENTION_MS,
} from '../webhook-events';
import { lookupHash } from '../identity';
import { createRecordingTransport } from '../conversation/recording-transport';
import { processWebhookEvents } from './engine';
import type { LineWebhookEvent } from '../types';

// § ต้องมี docker compose up -d postgres redis up-redis + .env.local ก่อนรัน
vi.setConfig({ testTimeout: 30_000 });

type EventRow = typeof lineWebhookEvents.$inferSelect;

// § ห้ามลบทั้งตารางบน DB Shared — เฉพาะ fixture prefix ของ suite นี้เท่านั้น และ fail fast
//   ถ้าเจอ row ที่ไม่ใช่ fixture (เช่น event จริงจาก webhook) ให้หยุดก่อนแตะข้อมูล
const FIXTURE_PREFIX = `it-eng-${Date.now()}-`;
const OWNED_DEDUP_KEYS: string[] = [];
const OWNED_EVENT_IDS: string[] = [];

async function assertCleanTarget(db: Awaited<ReturnType<typeof getDb>>) {
  const foreign = await db.select({ id: lineWebhookEvents.id }).from(lineWebhookEvents)
    .where(sql`${lineWebhookEvents.id} not like ${`${FIXTURE_PREFIX}%`}`)
    .limit(1);
  if (foreign.length > 0) {
    throw new Error('engine.integration: shared line_webhook_events detected — use a disposable test database');
  }
}

beforeAll(async () => {
  const db = await getDb();
  await assertCleanTarget(db);
});

afterAll(async () => {
  const db = await getDb();
  if (OWNED_EVENT_IDS.length > 0) {
    await db.delete(lineWebhookEvents).where(inArray(lineWebhookEvents.id, OWNED_EVENT_IDS));
  }
  await closeDb();
});

let seq = 0;
const BASE_TS = Date.now(); // § timestamp จริงแบบ Unix ms (13 ตัว) — ไม่ใช้ 1000/2000 ที่ผ่าน int4 ได้
function messageEvent(userId: string, offsetMs: number): LineWebhookEvent {
  seq++;
  return {
    type: 'message',
    replyToken: `reply-${seq}`,
    timestamp: BASE_TS + offsetMs,
    mode: 'active',
    webhookEventId: `${FIXTURE_PREFIX}webhook-${seq}`,
    source: { type: 'user', userId },
    message: { type: 'text', id: `${FIXTURE_PREFIX}msg-${seq}`, text: 'สวัสดี' },
  } as LineWebhookEvent;
}

async function insertRaw(overrides: Partial<EventRow> & { dedupKey: string; lineUserIdHash: string }): Promise<EventRow> {
  const db = await getDb();
  const id = `${FIXTURE_PREFIX}${overrides.dedupKey}`;
  OWNED_EVENT_IDS.push(id);
  const [row] = await db.insert(lineWebhookEvents).values({
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
    eventType: 'message',
    eventTimestamp: BASE_TS,
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
  test('retention ลบเฉพาะ terminal row ที่เก่า — pending/recent อยู่รอด', async () => {
    const old = new Date(Date.now() - WEBHOOK_RETENTION_MS - 60_000);
    const oldDone = await insertRaw({ dedupKey: 'retire-done', lineUserIdHash: 'h-retire', status: 'done', updatedAt: old });
    const oldPending = await insertRaw({ dedupKey: 'retire-pending', lineUserIdHash: 'h-retire', status: 'pending', updatedAt: old });
    const recentFailed = await insertRaw({ dedupKey: 'retire-recent', lineUserIdHash: 'h-retire', status: 'failed', updatedAt: new Date() });

    const deleted = await cleanupWebhookEvents();

    expect(deleted).toBeGreaterThanOrEqual(1);
    expect((await rowOf(oldDone.id))?.id).toBeUndefined();
    expect((await rowOf(oldPending.id)).status).toBe('pending');
    expect((await rowOf(recentFailed.id)).status).toBe('failed');

    // § กัน fixture pending นี้ไปติด claim ของ test อื่นใน suite เดียวกัน
    const db = await getDb();
    await db.delete(lineWebhookEvents).where(inArray(lineWebhookEvents.id, [oldPending.id, recentFailed.id]));
    OWNED_EVENT_IDS.splice(0, OWNED_EVENT_IDS.length, ...OWNED_EVENT_IDS.filter(
      (id) => id !== oldPending.id && id !== recentFailed.id,
    ));
  });

  test('failure ก่อน inbound → แถวยัง pending และไม่มี effects committed', async () => {
    const event = messageEvent('U-before', 0);
    const { id } = await enqueueWebhookEvent(event);
    expect(id).toBeTruthy();
    OWNED_EVENT_IDS.push(id!);
    const db = await getDb();
    await db.update(lineWebhookEvents).set({ leaseOwner: 'it-owner' }).where(eq(lineWebhookEvents.id, id!));

    await markFailed(id!, 1, 'it-owner');
    const row = await rowOf(id!);
    expect(row.status).toBe('pending');
    expect(row.effectsCommittedAt).toBeNull();
    expect(row.pendingReplies).toBeNull();
  });

  test('retry ไม่ duplicate inbound — ON CONFLICT DO NOTHING', async () => {
    const event = messageEvent('U-dedup', 10);
    const first = await enqueueWebhookEvent(event);
    const second = await enqueueWebhookEvent(event);
    if (first.id) OWNED_EVENT_IDS.push(first.id);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.id).toBeUndefined();

    const db = await getDb();
    const rows = await db.select().from(lineWebhookEvents)
      .where(eq(lineWebhookEvents.dedupKey, `w:${event.webhookEventId}`));
    expect(rows).toHaveLength(1);
  });

  test('failure หลัง effects commit → pendingReplies อยู่, retry ส่ง reply โดยไม่ทำ effects ซ้ำ', async () => {
    const event = messageEvent('U-after', 20);
    const { id } = await enqueueWebhookEvent(event);
    OWNED_EVENT_IDS.push(id!);
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
      eventTimestamp: BASE_TS,
      status: 'processing',
      effectsCommittedAt: null,
    });
    const later = await insertRaw({
      dedupKey: `barrier-${Date.now()}-2`,
      lineUserIdHash: hash,
      eventTimestamp: BASE_TS + 10,
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
      leaseOwner: 'it-owner',
    });
    await markFailed(row.id, 5, 'it-owner');
    expect((await rowOf(row.id)).status).toBe('failed');
  });

  test('claim เลือกตาม timestamp แล้ว id', async () => {
    const hash = `order-${Date.now()}`;
    const first = await insertRaw({
      dedupKey: `order-a-${Date.now()}`,
      lineUserIdHash: hash,
      eventTimestamp: BASE_TS,
    });
    const second = await insertRaw({
      dedupKey: `order-b-${Date.now()}`,
      lineUserIdHash: hash,
      eventTimestamp: BASE_TS + 10,
    });
    const [claimed] = await claimNextWebhookEvent(1);
    expect(claimed?.id).toBe(first.id);
    expect(second.id).not.toBe(claimed?.id);
  });


  test('สอง event ผู้ใช้เดียวใน batch เดียว → ทั้งคู่ถูกประมวลผล ไม่รอ cron', async () => {
    // § ข้อ 5 — predecessor filter กัน event ที่สองของผู้ใช้เดิม ถ้า processWebhookEvents
    //   หยุดที่ snapshot แรก event ที่สองจะค้างจนถึง cron ping 5 นาที เกินช่วง reply token
    const raw = `${FIXTURE_PREFIX}U-same`;
    const first = await enqueueWebhookEvent(messageEvent(raw, 0));
    const second = await enqueueWebhookEvent(messageEvent(raw, 10));
    OWNED_EVENT_IDS.push(first.id!, second.id!);

    const transport = createRecordingTransport();
    const outcome = await processWebhookEvents(50, transport);

    expect(outcome.attempted).toBeGreaterThanOrEqual(2);
    expect((await rowOf(first.id!)).status).toBe('done');
    expect((await rowOf(second.id!)).status).toBe('done');
  });

  test('backoff ใน SQL: event ที่ยังไม่ครบกำหนดไม่ถูก claim, ครบแล้วได้', async () => {
    const stamp = Date.now();
    const row = await insertRaw({
      dedupKey: `backoff-${stamp}`,
      lineUserIdHash: `h-backoff-${stamp}`,
      status: 'pending',
      attempts: 1,
      updatedAt: new Date(), // เพิ่งอัปเดต → ยังอยู่ใน backoff 2s (attempts=1)
    });
    const first = await claimNextWebhookEvent(10);
    expect(first.find((r) => r.id === row.id)).toBeUndefined();

    // เลื่อน updatedAt ให้พ้น backoff แล้วต้องถูก claim
    const db = await getDb();
    await db.update(lineWebhookEvents)
      .set({ updatedAt: new Date(Date.now() - 5000) })
      .where(eq(lineWebhookEvents.id, row.id));
    const second = await claimNextWebhookEvent(10);
    expect(second.find((r) => r.id === row.id)).toBeDefined();
  });

  test('profile: ผู้ใช้เดิมมีชื่อแล้ว → getProfile ไม่ถูกเรียก (0 ครั้ง)', async () => {
    const raw = `${FIXTURE_PREFIX}U-named`;
    const { id } = await enqueueWebhookEvent(messageEvent(raw, 0));
    OWNED_EVENT_IDS.push(id!);
    const db = await getDb();
    await db.update(lineUsers).set({ displayName: 'มีชื่อแล้ว' })
      .where(eq(lineUsers.lineUserIdHash, lookupHash(raw)));

    const transport = createRecordingTransport();
    await processWebhookEvents(50, transport);

    expect(transport.calls.filter((c) => c.kind === 'profile')).toHaveLength(0);
    expect((await rowOf(id!)).status).toBe('done');
  });

  test('first-contact: sender ไม่มีใน line_users → ingress สร้าง identity เดียวกับที่ restore ใช้', async () => {
    const db = await getDb();
    const raw = `${FIXTURE_PREFIX}U-first`;
    const [before] = await db.select({ id: lineUsers.id }).from(lineUsers)
      .where(eq(lineUsers.lineUserIdHash, lookupHash(raw))).limit(1);
    expect(before).toBeUndefined();

    const event = messageEvent(raw, 50);
    const { id } = await enqueueWebhookEvent(event);
    OWNED_EVENT_IDS.push(id!);
    const [user] = await db.select({ id: lineUsers.id }).from(lineUsers)
      .where(eq(lineUsers.lineUserIdHash, lookupHash(raw))).limit(1);
    expect(user).toBeTruthy();

    const [row] = await db.select().from(lineWebhookEvents).where(eq(lineWebhookEvents.id, id!)).limit(1);
    const restored = await restoreEvent(db, row as never);
    expect(restored.source.userId).toBe(raw);
    await db.delete(lineUsers).where(eq(lineUsers.id, user!.id));
  });

  test('เท่ากัน timestamp สองแถว: commitEffects ไม่มองตัวอื่นเป็น predecessor', async () => {
    const db = await getDb();
    const hash = `${FIXTURE_PREFIX}equal-user`;
    const first = await insertRaw({
      dedupKey: 'equal-a', lineUserIdHash: hash, eventTimestamp: BASE_TS + 100, status: 'pending',
    });
    const second = await insertRaw({
      dedupKey: 'equal-b', lineUserIdHash: hash, eventTimestamp: BASE_TS + 100, status: 'pending',
    });

    // § ทั้งสอง timestamp เท่ากัน — ต้องไม่มีใครบล็อกอีกตัว (ลำดับตัดด้วย id)
    await db.transaction((tx) => commitEffects(tx, first as never, async () => ({ replies: [] })));
    await db.transaction((tx) => commitEffects(tx, second as never, async () => ({ replies: [] })));
    const rows = await db.select({ id: lineWebhookEvents.id, committed: lineWebhookEvents.effectsCommittedAt })
      .from(lineWebhookEvents).where(inArray(lineWebhookEvents.id, [first.id, second.id]));
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.committed !== null)).toBe(true);
  });

  test('empty replies → markDone โดยไม่ยิง transport (reply_state=none)', async () => {
    const db = await getDb();
    const hash = `${FIXTURE_PREFIX}no-reply-user`;
    const row = await insertRaw({
      dedupKey: 'no-reply', lineUserIdHash: hash,
      eventTimestamp: BASE_TS + 200, status: 'processing',
      effectsCommittedAt: new Date(), pendingReplies: null, replyState: 'none',
      leaseOwner: 'it-owner', leaseUntil: new Date(Date.now() - 1000),
    });
    const transport = createRecordingTransport();
    await processWebhookEvents(50, transport);
    expect(transport.calls.filter((c) => c.kind === 'reply')).toHaveLength(0);
    expect((await rowOf(row.id)).status).toBe('done');
  });

  test('batch store อีก event เมื่อตัวหนึ่ง insert ไม่ได้ (dedupKey ซ้ำ)', async () => {
    const first = messageEvent('U-batch', 30);
    const stored = await enqueueWebhookEvent(first);
    if (stored.id) OWNED_EVENT_IDS.push(stored.id);
    const dup = { ...first, message: { type: 'text' as const, id: 'different-message', text: 'อื่น' } };
    const [a, b] = await Promise.all([
      enqueueWebhookEvent(dup),
      enqueueWebhookEvent(messageEvent('U-batch-2', 40)),
    ]);
    expect(a.ok).toBe(true);
    expect(a.id).toBeUndefined();
    expect(b.ok).toBe(true);
    expect(b.id).toBeTruthy();
    if (b.id) OWNED_EVENT_IDS.push(b.id);
    expect(stored.id).toBeTruthy();
  });
});
