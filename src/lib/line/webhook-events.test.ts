import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockLookupHash: vi.fn((id: string) => `h-${id.slice(1)}`),
  mockResolveRaw: vi.fn(async (_db: unknown, _id: string) => 'U123'),
  mockGenerateId: vi.fn(() => 'event-1'),
}));

vi.mock('@/lib/db', () => ({ getDb: hoisted.mockGetDb }));
vi.mock('@/lib/id', () => ({ generateId: hoisted.mockGenerateId }));
vi.mock('./identity', () => ({
  lookupHash: hoisted.mockLookupHash,
  resolveRawLineId: hoisted.mockResolveRaw,
}));

import {
  backoffMsFor,
  dedupKeyOf,
  enqueueWebhookEvent,
  markFailed,
  restoreEvent,
  sanitizeEvent,
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
    const set = vi.fn(() => ({ where: vi.fn() }));
    hoisted.mockGetDb.mockResolvedValue({ update: vi.fn(() => ({ set })) });
    await markFailed('event-1', 5);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('attempts < 5 → pending', async () => {
    const set = vi.fn(() => ({ where: vi.fn() }));
    hoisted.mockGetDb.mockResolvedValue({ update: vi.fn(() => ({ set })) });
    await markFailed('event-1', 1);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
  });
});
