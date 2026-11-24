import { and, asc, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '@/lib/db';
import { queueBookings } from '@/lib/db/schema';
import { toLocalISODate } from '@/lib/validation';

export const QUEUE_PAGE_SIZE = 100;

export type QueueCategoryFilter = 'all' | 'technician' | 'government';
export type QueueRangeFilter = 'upcoming' | 'today' | 'past' | 'all';

export interface QueueListParams {
  category: QueueCategoryFilter;
  range: QueueRangeFilter;
  page: number;
}

export interface QueueListResult {
  bookings: (typeof queueBookings.$inferSelect)[];
  page: number;
  totalRows: number;
  totalPages: number;
}

type RawParams = Record<string, string | string[] | undefined>;

const CATEGORIES = new Set<QueueCategoryFilter>(['all', 'technician', 'government']);
const RANGES = new Set<QueueRangeFilter>(['upcoming', 'today', 'past', 'all']);

function firstString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** § ตัวกรองมาจาก URL — ต้อง whitelist ทุกค่า ก่อนใช้ใน SQL หรือ href */
export function parseQueueListParams(params: RawParams): QueueListParams {
  const rawCategory = firstString(params.category) ?? 'all';
  const rawRange = firstString(params.range) ?? 'upcoming';
  const rawPage = Number.parseInt(firstString(params.page) ?? '1', 10);

  return {
    category: CATEGORIES.has(rawCategory as QueueCategoryFilter)
      ? (rawCategory as QueueCategoryFilter)
      : 'all',
    range: RANGES.has(rawRange as QueueRangeFilter) ? (rawRange as QueueRangeFilter) : 'upcoming',
    page: Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1,
  };
}

/** § เปลี่ยนตัวกรองแล้วต้อง reset หน้า — ไม่เช่นนั้น page เกินจำนวนหน้าใหม่ */
export function buildQueueHref(
  params: QueueListParams,
  overrides: Partial<QueueListParams> = {},
): string {
  const next = { ...params, ...overrides };
  const filtersChanged =
    (overrides.category !== undefined && overrides.category !== params.category) ||
    (overrides.range !== undefined && overrides.range !== params.range);
  if (filtersChanged && overrides.page === undefined) next.page = 1;

  const q = new URLSearchParams();
  if (next.category !== 'all') q.set('category', next.category);
  if (next.range !== 'upcoming') q.set('range', next.range);
  if (next.page > 1) q.set('page', String(next.page));
  const qs = q.toString();
  return `/admin/queue${qs ? `?${qs}` : ''}`;
}

/** § ใช้ where เดียวกันสำหรับ count และ select — กัน total ไม่ตรงกับหน้าที่แสดง */
export async function listQueueBookings(
  db: DbOrTx,
  params: QueueListParams,
  now: Date = new Date(),
): Promise<QueueListResult> {
  const todayStr = toLocalISODate(now);
  const conditions: SQL[] = [];

  if (params.category !== 'all') {
    conditions.push(eq(queueBookings.category, params.category));
  }
  if (params.range === 'today') {
    conditions.push(eq(queueBookings.bookingDate, todayStr));
  } else if (params.range === 'upcoming') {
    conditions.push(gte(queueBookings.bookingDate, todayStr));
  } else if (params.range === 'past') {
    conditions.push(lt(queueBookings.bookingDate, todayStr));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const countRows = await db
    .select({ c: count() })
    .from(queueBookings)
    .where(where);
  const totalRows = countRows[0]?.c ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / QUEUE_PAGE_SIZE));
  const page = Math.min(Math.max(1, params.page), totalPages);

  // § id เป็นตัวตัดสินสุดท้าย — วัน/ช่องเดียวกันต้องไม่สลับข้ามหน้า
  const orderBy =
    params.range === 'past'
      ? [desc(queueBookings.bookingDate), desc(queueBookings.slot), desc(queueBookings.id)]
      : [asc(queueBookings.bookingDate), asc(queueBookings.slot), asc(queueBookings.id)];

  const bookings = await db
    .select()
    .from(queueBookings)
    .where(where)
    .orderBy(...orderBy)
    .limit(QUEUE_PAGE_SIZE)
    .offset((page - 1) * QUEUE_PAGE_SIZE);

  return { bookings, page, totalRows, totalPages };
}
