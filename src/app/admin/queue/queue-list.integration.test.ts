import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { queueBookings } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { listQueueBookings, QUEUE_PAGE_SIZE, parseQueueListParams } from './queue-list';

/**
 * listQueueBookings — ทดสอบกับ Postgres จริง ต้องการ docker compose up -d postgres
 * ครอบด้วย ID เฉพาะชุดเพื่อไม่ให้ชน partial unique index ของ (category, date, slot)
 */
const RUN = Date.now();
const DATE = '2099-06-15';
const PAST_DATE = '2001-06-15';
const SLOT = 'it-pagination';
const ids: string[] = [];

function idFor(n: number) {
  return `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
}

beforeAll(async () => {
  const db = await getDb();
  const values = Array.from({ length: 105 }, (_, i) => ({
    id: idFor(i + 1),
    fullName: `ผู้ทดสอบ ${i + 1} (${RUN})`,
    phoneNumber: '0900000000',
    category: 'technician' as const,
    serviceType: 'ทดสอบแบ่งหน้า',
    bookingDate: DATE,
    slot: `${SLOT}-${RUN}`,
    status: 'cancelled' as const, // cancelled ไม่ติด partial unique index
  }));
  // คิวในอดีต 3 รายการเพื่อทดสอบลำดับย้อนหลัง — วันเดียวกัน slot เดียวกัน คนละ id
  const past = [201, 202, 203].map((n) => ({
    ...values[0]!,
    id: idFor(n),
    bookingDate: PAST_DATE,
    slot: `${SLOT}-past-${RUN}`,
    fullName: `อดีต ${n} (${RUN})`,
  }));
  ids.push(...values.map((v) => v.id), ...past.map((v) => v.id));
  await db.insert(queueBookings).values([...values, ...past]);
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(queueBookings).where(inArray(queueBookings.id, ids));
  await closeDb();
});

describe('listQueueBookings', () => {
  test('105 รายการวัน/ช่องเดียวกัน แบ่งหน้า 100 + 5 ไม่ซ้ำ และเรียง id ASC เสมอ', async () => {
    const db = await getDb();
    // § range=today กับ now=DATE จะกรองเอาเฉพาะ 105 แถววันเดียวกัน — กันแถวอดีตเข้ามารบกวน
    const params = parseQueueListParams({ category: 'technician', range: 'today', page: '1' });
    const page1 = await listQueueBookings(db, params, new Date(`${DATE}T00:00:00Z`));
    const page2 = await listQueueBookings(
      db,
      { ...params, page: 2 },
      new Date(`${DATE}T00:00:00Z`),
    );

    expect(page1.totalRows).toBe(105);
    expect(page1.totalPages).toBe(2);
    expect(page1.bookings).toHaveLength(QUEUE_PAGE_SIZE);
    expect(page2.bookings).toHaveLength(5);
    expect(page1.bookings.map((b) => b.id)).toEqual(ids.slice(0, 100));
    expect(page2.bookings.map((b) => b.id)).toEqual(ids.slice(100, 105));

    const union = [...page1.bookings, ...page2.bookings].map((b) => b.id);
    expect(new Set(union).size).toBe(105);
  });

  test('range=past เรียง bookingDate/slot/id แบบ DESC', async () => {
    const db = await getDb();
    const params = parseQueueListParams({ range: 'past' });
    const page = await listQueueBookings(db, params, new Date(`${DATE}T00:00:00Z`));

    expect(page.bookings).toHaveLength(3);
    expect(page.bookings.map((b) => b.id)).toEqual([idFor(203), idFor(202), idFor(201)]);
  });

  test('page เกิน totalPages ถูก clamp กลับมาหน้าสุดท้าย', async () => {
    const db = await getDb();
    const params = parseQueueListParams({ range: 'past', page: '99' });
    const page = await listQueueBookings(db, params, new Date(`${DATE}T00:00:00Z`));

    expect(page.page).toBe(1);
    expect(page.bookings.map((b) => b.id)).toEqual([idFor(203), idFor(202), idFor(201)]);
  });

  test('ตัวกรอง category ยังทำงานร่วมกับ pagination', async () => {
    const db = await getDb();
    const params = parseQueueListParams({ category: 'government', range: 'all' });
    const page = await listQueueBookings(db, params, new Date(`${DATE}T00:00:00Z`));

    expect(page.totalRows).toBe(0);
    expect(page.bookings).toEqual([]);
  });
});
