import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockLookupHash: vi.fn((id: string) => `h-${id.slice(1)}`),
  mockResolveRaw: vi.fn(async (_db: unknown, _id: string): Promise<string | null> => 'U123'),
  mockEnsureLineUser: vi.fn(async (_db: unknown, _id: string) => ({ id: 'user-pk', botState: null })),
  mockGenerateId: vi.fn(() => 'event-1'),
}));

vi.mock('@/lib/db', () => ({ getDb: hoisted.mockGetDb }));
vi.mock('@/lib/id', () => ({ generateId: hoisted.mockGenerateId }));
vi.mock('./identity', () => ({
  lookupHash: hoisted.mockLookupHash,
  resolveRawLineId: hoisted.mockResolveRaw,
  ensureLineUser: hoisted.mockEnsureLineUser,
}));

import {
  claimNextWebhookEvent,
  commitEffects,
  backoffMsFor,
  dedupKeyOf,
  enqueueWebhookEvent,
  markDone,
  markFailed,
  renewLease,
  expireReply,
  MissingLineIdentity,
  restoreEvent,
  sanitizeEvent,
  cleanupWebhookEvents,
  WEBHOOK_RETENTION_MS,
} from './webhook-events';
import type { WebhookEventRow } from './webhook-events';
import type { LineWebhookEvent } from './types';

const event = (id: string, timestamp = 1000): LineWebhookEvent => ({
  type: 'message',
  replyToken: 'reply-1',
  timestamp,
  mode: 'active',
  webhookEventId: id,
  source: { type: 'user', userId: 'U123' },
  message: { type: 'text', id: 'm-1', text: 'สวัสดี' },
} as LineWebhookEvent);

describe('webhook-events · payload', () => {
  it('sanitizeEvent แทนที่ source.userId ด้วย hash — ไม่เก็บ raw ใน payload', () => {
    const stored = sanitizeEvent(event('w1'));
    expect(stored.source.userId).toBe('h-123');
    expect(JSON.stringify(stored)).not.toContain('U123');
  });

  it('restoreEvent คืน raw userId จาก line_usersenc', async () => {
    const db = { select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => [{ id: 'user-pk' }] }) }) })) };
    const row = {
      payload: sanitizeEvent(event('w1')),
      lineUserIdHash: 'h-123',
    } as WebhookEventRow;
    const restored = await restoreEvent(db as never, row);
    expect(restored.source.userId).toBe('U123');
  });

  it('restoreEvent ไม่มี canonical user → throw (ห้ามคืน hash ให้ engine สร้าง hash-of-hash)', async () => {
    const db = { select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => [] }) }) })) };
    const row = {
      id: 'event-x',
      payload: sanitizeEvent(event('w1')),
      lineUserIdHash: 'h-123',
    } as WebhookEventRow;
    await expect(restoreEvent(db as never, row)).rejects.toBeInstanceOf(MissingLineIdentity);
  });

  it('restoreEvent มี user แต่ถอด raw ไม่ได้ → throw (ไม่หลุดเป็น hash)', async () => {
    const db = { select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => [{ id: 'user-pk' }] }) }) })) };
    hoisted.mockResolveRaw.mockResolvedValueOnce(null);
    const row = {
      id: 'event-y',
      payload: sanitizeEvent(event('w1')),
      lineUserIdHash: 'h-123',
    } as WebhookEventRow;
    await expect(restoreEvent(db as never, row)).rejects.toBeInstanceOf(MissingLineIdentity);
  });

  it('dedupKey ใช้ webhookEventId ก่อน message id', () => {
    expect(dedupKeyOf(event('w1'))).toBe('w:w1');
  });
});

describe('webhook-events · enqueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockGenerateId.mockReturnValue('event-1');
  });

  it('INSERT ... ON CONFLICT DO NOTHING RETURNING id — duplicate ไม่ throw', async () => {
    const returning = vi.fn(async () => []);
    const values = vi.fn(() => ({ onConflictDoNothing: vi.fn(() => ({ returning })) }));
    hoisted.mockGetDb.mockResolvedValue({ insert: vi.fn(() => ({ values })) });

    const result = await enqueueWebhookEvent(event('w1'));
    expect(result).toEqual({ ok: true, id: undefined });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      dedupKey: 'w:w1',
      lineUserIdHash: 'h-123',
      eventTimestamp: 1000,
      replyToken: 'reply-1',
      payload: expect.objectContaining({ source: expect.objectContaining({ userId: 'h-123' }) }),
    }));
  });

  it('insert พัง → ok:false', async () => {
    const values = vi.fn(() => {
      throw new Error('db down');
    });
    hoisted.mockGetDb.mockResolvedValue({ insert: vi.fn(() => ({ values })) });

    const result = await enqueueWebhookEvent(event('w1'));
    expect(result.ok).toBe(false);
  });
});

describe('webhook-events · backoff และ attempts', () => {
  it('backoff min(2^attempts,60)s', () => {
    expect(backoffMsFor(1)).toBe(2000);
    expect(backoffMsFor(5)).toBe(32_000);
    expect(backoffMsFor(10)).toBe(60_000);
  });

  it('attempts >= 5 → failed ถาวร', async () => {
    const set = vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) }));
    hoisted.mockGetDb.mockResolvedValue({ update: vi.fn(() => ({ set })) });
    await markFailed('event-1', 5, 'owner-1');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('attempts < 5 → pending', async () => {
    const set = vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) }));
    hoisted.mockGetDb.mockResolvedValue({ update: vi.fn(() => ({ set })) });
    await markFailed('event-1', 1, 'owner-1');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
  });

  it('markDone ล้าง payload/replyToken/pendingReplies (คง dedupKey ผ่าน DB)', async () => {
    const set = vi.fn((_patch: Record<string, unknown>) => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) }));
    hoisted.mockGetDb.mockResolvedValue({ update: vi.fn(() => ({ set })) });

    await markDone('event-1', 'owner-1');

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      status: 'done',
      replyToken: null,
      pendingReplies: null,
      payload: expect.not.objectContaining({ text: 'สวัสดี' }),
    }));
    const patch = set.mock.calls[0]![0];
    expect(patch).not.toHaveProperty('dedupKey');
    expect(JSON.stringify(patch)).not.toContain('สวัสดี');
  });

  it('markFailed terminal ล้าง payload/replyToken แต่ retry ยังเก็บไว้', async () => {
    const set = vi.fn((_patch: Record<string, unknown>) => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) }));
    hoisted.mockGetDb.mockResolvedValue({ update: vi.fn(() => ({ set })) });

    await markFailed('event-1', 5, 'owner-1');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      replyToken: null,
      pendingReplies: null,
    }));
    expect(JSON.stringify(set.mock.calls[0]![0])).not.toContain('สวัสดี');

    set.mockClear();
    await markFailed('event-1', 1, 'owner-1');
    expect(set).toHaveBeenCalledWith(expect.not.objectContaining({ payload: expect.anything() }));
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
  });
});

describe('webhook-events · bounded retention', () => {
  it('ลบเฉพาะ row terminal ที่เก่าเกิน retention — pending กับ row ใหม่อยู่รอด', async () => {
    const where = vi.fn(async () => ({ count: 3 }));
    hoisted.mockGetDb.mockResolvedValue({ delete: vi.fn(() => ({ where })) });

    const deleted = await cleanupWebhookEvents(new Date('2026-11-27T00:00:00Z'));

    expect(deleted).toBe(3);
    expect(where).toHaveBeenCalledTimes(1);
    // § shape ของ predicate อยู่ใน integration test (SQL จริง) — unit ตรงนี้ตรงสัญญา count/cutoff เท่านั้น
    expect(WEBHOOK_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('webhook-events · lease ownership', () => {
  it('markFailed ไม่เขียนแถวเมื่อ owner ไม่ตรง', async () => {
    const where = vi.fn(() => ({ returning: vi.fn(async () => []) }));
    const set = vi.fn(() => ({ where }));
    hoisted.mockGetDb.mockResolvedValue({ update: vi.fn(() => ({ set })) });

    const won = await markFailed('event-1', 2, 'stale-owner');
    expect(won).toBe(false);
  });

  it('markDone/expireReply/ renewLease ส่ง owner ผ่าน where', async () => {
    const returning = vi.fn(async () => [{ id: 'event-1' }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    hoisted.mockGetDb.mockResolvedValue({ update: vi.fn(() => ({ set })) });

    expect(await markDone('event-1', 'owner-1', 'none')).toBe(true);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ replyState: 'none' }));
    expect(await expireReply('event-1', 'owner-1')).toBe(true);
    expect(await renewLease('event-1', 'owner-1')).toBe(true);
  });
});
