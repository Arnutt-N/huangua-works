import { createHash } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatBroadcasts, chatBroadcastFailedRecipients, lineUsers } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import {
  broadcastRetryKey,
  MULTICAST_BATCH_SIZE,
  recoverStaleSending,
  sendBroadcast,
  STALE_SENDING_MS,
} from './broadcast-service';

// § full suite โหลดพร้อมกัน 501 แถว + retry 3 ครั้ง → timeout เริ่มต้น 10s ไม่พอทั้ง test/hook
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const { multicastMock, LineApiErrorMock } = vi.hoisted(() => {
  class LineApiErrorMock extends Error {
    constructor(endpoint: string, public readonly status: number, detail: string) {
      super(`LINE API ${endpoint} failed (${status}): ${detail}`);
      this.name = 'LineApiError';
    }
  }
  return { multicastMock: vi.fn(), LineApiErrorMock };
});

vi.mock('./client', () => ({
  broadcastMessage: vi.fn(),
  getFollowerIds: vi.fn(async () => ({ userIds: [] })),
  multicast: multicastMock,
  LineApiError: LineApiErrorMock,
}));

vi.mock('./identity', () => ({ decryptLineId: (enc: string) => enc }));

/**
 * Integration — ต้องมี docker compose up -d postgres redis up-redis
 * ทดสอบ state จริงใน Postgres กับ service จริง (LINE client ถูก mock เพื่อไม่ยิงภายนอก)
 */

const createdBroadcastIds: string[] = [];
const createdUserIds: string[] = [];

beforeAll(async () => {
  const db = await getDb();
  expect(db).toBeTruthy();
});

afterAll(async () => {
  const db = await getDb();
  if (createdBroadcastIds.length > 0) {
    await db
      .delete(chatBroadcastFailedRecipients)
      .where(inArray(chatBroadcastFailedRecipients.broadcastId, createdBroadcastIds));
    await db.delete(chatBroadcasts).where(inArray(chatBroadcasts.id, createdBroadcastIds));
  }
  if (createdUserIds.length > 0) {
    await db.delete(lineUsers).where(inArray(lineUsers.id, createdUserIds));
  }
  await closeDb();
});

describe('recoverStaleSending · ฐานจริง', () => {
  it('requeue sending ค้าง → scheduled, updatedAt ใหม่, ไม่ mark failed', async () => {
    const db = await getDb();
    const id = generateId();
    createdBroadcastIds.push(id);
    const old = new Date(Date.now() - STALE_SENDING_MS - 60_000);
    await db.insert(chatBroadcasts).values({
      id,
      content: [],
      status: 'sending',
      target: { kind: 'all' },
      updatedAt: old,
    });

    const recovered = await recoverStaleSending();

    expect(recovered).toBeGreaterThanOrEqual(1);
    const [row] = await db.select().from(chatBroadcasts).where(eq(chatBroadcasts.id, id));
    expect(row?.status).toBe('scheduled');
    expect(row?.scheduledAt?.getTime()).toBeGreaterThan(old.getTime());
    expect(row?.updatedAt.getTime()).toBeGreaterThan(old.getTime());
    expect(row?.errorMessage).toBeNull();
  });
});

describe('sendBroadcast · counters/hash บนฐานจริง', () => {
  it('501 recipients แบ่งชุด key ต่างกัน ชุดสองล้ม → counters + failed hash ถูกต้อง', async () => {
    const db = await getDb();
    const rows = Array.from({ length: MULTICAST_BATCH_SIZE + 1 }, (_, i) => {
      const id = generateId();
      createdUserIds.push(id);
      return { id, lineUserIdHash: `prf-hash-${id}`, lineUserIdEnc: `U${i}` };
    });
    const ids = rows.map((row) => row.id);
    await db.insert(lineUsers).values(rows);
    const broadcastId = generateId();
    createdBroadcastIds.push(broadcastId);
    await db.insert(chatBroadcasts).values({
      id: broadcastId,
      content: [],
      status: 'scheduled',
      target: { kind: 'line_user_ids', ids },
    });

    const fail = new LineApiErrorMock('/message/multicast', 500, 'integration');
    multicastMock.mockReset();
    multicastMock.mockResolvedValueOnce(undefined).mockRejectedValue(fail);

    const outcome = await sendBroadcast(broadcastId);

    expect(multicastMock).toHaveBeenCalledTimes(4);
    const calls = multicastMock.mock.calls;
    expect(calls[0]?.[0]).toHaveLength(MULTICAST_BATCH_SIZE);
    expect(calls[1]?.[0]).toHaveLength(1);
    expect(calls[0]?.[2]).toBe(broadcastRetryKey(broadcastId, 0));
    expect(calls[3]?.[2]).toBe(broadcastRetryKey(broadcastId, 1));
    expect(calls[0]?.[2]).not.toBe(calls[3]?.[2]);
    expect(outcome).toMatchObject({
      kind: 'failed',
      totalRecipients: MULTICAST_BATCH_SIZE + 1,
      successCount: MULTICAST_BATCH_SIZE,
      failedCount: 1,
    });

    const [row] = await db.select().from(chatBroadcasts).where(eq(chatBroadcasts.id, broadcastId));
    expect(row).toMatchObject({
      status: 'failed',
      totalRecipients: MULTICAST_BATCH_SIZE + 1,
      successCount: MULTICAST_BATCH_SIZE,
      failedCount: 1,
    });

    const failed = await db
      .select()
      .from(chatBroadcastFailedRecipients)
      .where(eq(chatBroadcastFailedRecipients.broadcastId, broadcastId));
    const rawLast = `U${MULTICAST_BATCH_SIZE}`;
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({
      recipientHash: createHash('sha256').update(rawLast).digest('hex'),
      attempts: 3,
    });
    expect(JSON.stringify(failed)).not.toContain(rawLast);
  }, 30_000);
});
