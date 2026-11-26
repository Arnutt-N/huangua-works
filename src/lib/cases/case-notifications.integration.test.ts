import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/** Integration — ต้องมี local Postgres; พิสูจน์ outbox อยู่ใน tx เดียวกับเรื่องและส่งได้ครั้งเดียว */
const notifyControl = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }));

vi.mock('@/lib/notify', () => ({
  notifyNewCase: vi.fn(async (notice: Record<string, unknown>) => {
    notifyControl.calls.push(notice);
    return [];
  }),
}));

import { getDb } from '@/lib/db';
import { caseNotifications, cases, categories } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { createCaseInTx, dispatchPendingCaseNotifications } from './intake';

const RUN = Date.now().toString().slice(-9);
const createdCaseIds: string[] = [];
let categoryId: string;

beforeAll(async () => {
  const db = await getDb();
  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน seed ก่อน');
  categoryId = category.id;
});

afterAll(async () => {
  const db = await getDb();
  if (createdCaseIds.length > 0) {
    await db.delete(caseNotifications).where(inArray(caseNotifications.caseId, createdCaseIds));
    await db.delete(cases).where(inArray(cases.id, createdCaseIds));
  }
});

function input(over: Record<string, unknown> = {}) {
  return {
    channel: 'web' as const,
    title: `แจ้งเตือน outbox ${RUN}`,
    description: 'รายละเอียดทดสอบ outbox',
    categoryId,
    cid: `99${RUN}`.slice(0, 13).padEnd(13, '0'),
    ...over,
  };
}

describe('case notification outbox · ฐานจริง', () => {
  it('rollback ของ tx ไม่ทิ้ง outbox', async () => {
    const db = await getDb();
    await expect(
      db.transaction(async (tx) => {
        const result = await createCaseInTx(tx, input({ title: `rollback outbox ${RUN}` }));
        if (!result.ok) throw new Error(`create failed: ${result.error}`);
        createdCaseIds.push(result.caseId);
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow('forced rollback');

    const rows = await db.select().from(caseNotifications).where(eq(caseNotifications.caseId, createdCaseIds[0]!));
    expect(rows).toHaveLength(0);
  });

  it.each(['web', 'line'] as const)('ช่องทาง %s ส่งได้ครั้งเดียวแม้ replay', async (channel) => {
    const db = await getDb();
    const before = notifyControl.calls.length;
    const payload = input({
      channel,
      title: `replay ${channel} ${RUN}`,
      lineUserId: channel === 'line' ? `U-outbox-${channel}-${RUN}` : undefined,
      cid: channel === 'web' ? `98${RUN}`.slice(0, 13).padEnd(13, '0') : undefined,
    });

    const first = await db.transaction((tx) => createCaseInTx(tx, payload));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    createdCaseIds.push(first.caseId);

    const replay = await db.transaction((tx) => createCaseInTx(tx, payload));
    expect(replay.ok).toBe(false);

    await dispatchPendingCaseNotifications();
    await dispatchPendingCaseNotifications();

    expect(notifyControl.calls.length - before).toBe(1);
    expect(notifyControl.calls.at(-1)).toMatchObject({
      trackingCode: first.trackingCode,
      title: payload.title,
      channel,
    });
    const rows = await db.select().from(caseNotifications).where(eq(caseNotifications.caseId, first.caseId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'sent', caseId: first.caseId });
  });
});
