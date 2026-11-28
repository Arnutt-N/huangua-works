import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/** Integration — ต้องมี local Postgres; พิสูจน์ outbox อยู่ใน tx เดียวกับเรื่องและส่งได้ครั้งเดียว */
const notifyControl = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[], deliveries: [] as { status: string; retryable?: boolean; error?: string }[] }));

vi.mock('@/lib/notify', () => ({
  notifyNewCase: vi.fn(async (notice: Record<string, unknown>) => {
    notifyControl.calls.push(notice);
    // § คืนผลต่อ channel ตามที่ test ตั้งไว้ (ค่าเริ่มต้น = ส่งสำเร็จทุกช่องทาง)
    return notifyControl.deliveries.map((d) => ({ channel: 'telegram', ...d }));
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

beforeEach(() => {
  // § เริ่มต้นส่งสำเร็จทุกช่องทาง — เคสเฉพาะจะ override notifyControl.deliveries
  notifyControl.deliveries = [{ status: 'sent' }];
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

  it('ทุกช่องทาง retryable (503) → pending + nextAttemptAt ไม่ใช่ sent', async () => {
    const db = await getDb();
    notifyControl.deliveries = [
      { status: 'failed', retryable: true, error: 'HTTP 503' },
      { status: 'failed', retryable: true, error: 'HTTP 503' },
    ];
    const payload = input({ title: `retryable ${RUN}`, cid: `97${RUN}`.slice(0, 13).padEnd(13, '0') });
    const first = await db.transaction((tx) => createCaseInTx(tx, payload));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    createdCaseIds.push(first.caseId);

    const result = await dispatchPendingCaseNotifications();
    expect(result).toMatchObject({ pending: 1, sent: 0, failed: 0 });

    const [row] = await db.select().from(caseNotifications).where(eq(caseNotifications.caseId, first.caseId));
    expect(row!.status).toBe('pending');
    expect(row!.nextAttemptAt).toBeInstanceOf(Date);
    expect(row!.leaseOwner).toBeNull();
  });

  it('ล้มเหลวถาวร (4xx) ทุกช่องทาง → failed ไม่ตั้งรอ retry', async () => {
    const db = await getDb();
    notifyControl.deliveries = [{ status: 'failed', retryable: false, error: 'HTTP 400' }];
    const payload = input({ title: `hardfail ${RUN}`, cid: `96${RUN}`.slice(0, 13).padEnd(13, '0') });
    const first = await db.transaction((tx) => createCaseInTx(tx, payload));
    if (!first.ok) return;
    createdCaseIds.push(first.caseId);

    const result = await dispatchPendingCaseNotifications();
    expect(result).toMatchObject({ failed: 1, sent: 0, pending: 0 });

    const [row] = await db.select().from(caseNotifications).where(eq(caseNotifications.caseId, first.caseId));
    expect(row!.status).toBe('failed');
    expect(row!.nextAttemptAt).toBeNull();
  });

  it('ส่งสำเร็จบางช่องทาง (หนึ่ง sent หนึ่ง skipped) → sent', async () => {
    const db = await getDb();
    notifyControl.deliveries = [
      { status: 'sent' },
      { status: 'skipped' },
    ];
    const payload = input({ title: `partial-ok ${RUN}`, cid: `95${RUN}`.slice(0, 13).padEnd(13, '0') });
    const first = await db.transaction((tx) => createCaseInTx(tx, payload));
    if (!first.ok) return;
    createdCaseIds.push(first.caseId);

    const result = await dispatchPendingCaseNotifications();
    expect(result).toMatchObject({ sent: 1, failed: 0, pending: 0 });

    const [row] = await db.select().from(caseNotifications).where(eq(caseNotifications.caseId, first.caseId));
    expect(row!.status).toBe('sent');
  });

  it('งานค้างที่ sending เมื่อ worker หยุด (lease หมด) → re-claim และส่งได้', async () => {
    const db = await getDb();
    notifyControl.deliveries = [{ status: 'sent' }];
    const payload = input({ title: `stuck ${RUN}`, cid: `94${RUN}`.slice(0, 13).padEnd(13, '0') });
    const first = await db.transaction((tx) => createCaseInTx(tx, payload));
    if (!first.ok) return;
    createdCaseIds.push(first.caseId);

    // § จำลอง worker หยุดหลัง claim: ค้าง 'sending' พร้อม lease ที่หมดอายุแล้ว
    await db.update(caseNotifications)
      .set({ status: 'sending', leaseOwner: 'dead-worker', claimedUntil: new Date(Date.now() - 1000) })
      .where(eq(caseNotifications.caseId, first.caseId));

    const result = await dispatchPendingCaseNotifications();
    expect(result.sent).toBe(1);

    const [row] = await db.select().from(caseNotifications).where(eq(caseNotifications.caseId, first.caseId));
    expect(row!.status).toBe('sent');
  });
});
