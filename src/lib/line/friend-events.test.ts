import { describe, expect, it, vi } from 'vitest';

const inserted: unknown[] = vi.hoisted(() => []);
let conflictRows: { id: string }[] = [{ id: 'x' }];
let eventRows: { event: string; createdAt: Date }[] = [];

vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));

const mockDb = {
  insert: () => ({
    values: (v: unknown) => {
      inserted.length = 0;
      inserted.push(v);
      return {
        onConflictDoNothing: () => ({ returning: async () => conflictRows }),
      };
    },
  }),
  select: (fields?: unknown) => ({
    from: () => ({
      where: () => {
        if (fields && typeof fields === 'object' && 'value' in (fields as object)) {
          return Promise.resolve([{ value: eventRows.filter((r) => r.event === 'follow').length }]);
        }
        return { orderBy: async () => eventRows };
      },
    }),
  }),
} as never;

import { getRefollowCount, recordFriendEvent } from './friend-events';

describe('recordFriendEvent · durable dedup', () => {
  it('insert ครั้งแรกคืน true', async () => {
    conflictRows = [{ id: 'x' }];
    const ok = await recordFriendEvent(mockDb, 'pk1', 'follow', 'evt-1');
    expect(ok).toBe(true);
    expect(inserted[0]).toMatchObject({ lineUserId: 'pk1', event: 'follow', webhookEventId: 'evt-1' });
  });

  it('redelivery (conflict ไม่ insert) คืน false ไม่สร้างแถวซ้ำ', async () => {
    conflictRows = [];
    const ok = await recordFriendEvent(mockDb, 'pk1', 'follow', 'evt-1');
    expect(ok).toBe(false);
  });
});

describe('getRefollowCount · derived (follow หลัง unfollow)', () => {
  it('follow เดี่ยวไม่นับ, follow หลัง unfollow นับ', async () => {
    eventRows = [
      { event: 'follow', createdAt: new Date(1) },
      { event: 'unfollow', createdAt: new Date(2) },
      { event: 'follow', createdAt: new Date(3) },
      { event: 'unfollow', createdAt: new Date(4) },
      { event: 'follow', createdAt: new Date(5) },
    ];
    expect(await getRefollowCount(mockDb, 'pk1')).toBe(2);
  });

  it('follow สองครั้งโดยไม่มี unfollow คั่นไม่นับ', async () => {
    eventRows = [
      { event: 'follow', createdAt: new Date(1) },
      { event: 'follow', createdAt: new Date(2) },
    ];
    expect(await getRefollowCount(mockDb, 'pk1')).toBe(0);
  });
});
