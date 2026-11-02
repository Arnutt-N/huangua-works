import type { Metadata } from 'next';
import Link from 'next/link';
import { and, asc, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { queueBookings } from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminShell } from '@/components/admin/admin-shell';
import { formatThaiDateLong } from '@/lib/thai-date';
import {
  QUEUE_BOOKING_STATUS_LABELS,
  QUEUE_CATEGORY_LABELS,
  QUEUE_SLOT_LABELS,
  toLocalISODate,
  type QueueBookingStatus,
  type QueueCategory,
  type QueueSlotId,
} from '@/lib/validation';
import { QueueRowForm } from './queue-row-form';
import { HUA_NGUA_VILLAGES } from '@/app/queue/villages';

export const metadata: Metadata = { title: 'คิวนัดหมายและนัดช่าง' };
export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<QueueBookingStatus, string> = {
  booked: 'bg-accent-sunken text-accent-strong',
  confirmed: 'bg-success-soft text-success-ink',
  done: 'bg-surface-raised text-muted ring-1 ring-inset ring-border',
  cancelled: 'bg-danger-soft text-danger-ink',
};

const CATEGORY_BADGE: Record<QueueCategory, string> = {
  technician: 'bg-primary-soft text-primary-ink',
  government: 'bg-surface-sunken text-ink ring-1 ring-inset ring-border',
};

const villageNameMap = new Map(HUA_NGUA_VILLAGES.map((v) => [v.id, v.name]));

interface AdminQueuePageProps {
  searchParams: Promise<{
    category?: string;
    range?: string;
  }>;
}

export default async function AdminQueuePage({ searchParams }: AdminQueuePageProps) {
  const { user: staffUser } = await requireStaff();
  const db = await getDb();

  const params = await searchParams;
  const activeCategory = (params.category ?? 'all') as 'all' | QueueCategory;
  const activeRange = (params.range ?? 'upcoming') as 'upcoming' | 'today' | 'past' | 'all';

  const todayStr = toLocalISODate(new Date());

  const conditions: SQL[] = [];

  if (activeCategory === 'technician' || activeCategory === 'government') {
    conditions.push(eq(queueBookings.category, activeCategory));
  }

  if (activeRange === 'today') {
    conditions.push(eq(queueBookings.bookingDate, todayStr));
  } else if (activeRange === 'upcoming') {
    conditions.push(gte(queueBookings.bookingDate, todayStr));
  } else if (activeRange === 'past') {
    conditions.push(lt(queueBookings.bookingDate, todayStr));
  }

  const query = db
    .select()
    .from(queueBookings)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  if (activeRange === 'past') {
    query.orderBy(desc(queueBookings.bookingDate), desc(queueBookings.slot));
  } else {
    query.orderBy(asc(queueBookings.bookingDate), asc(queueBookings.slot));
  }

  const bookings = await query.limit(100);

  function filterHref(cat: string, rng: string) {
    const q = new URLSearchParams();
    if (cat !== 'all') q.set('category', cat);
    if (rng !== 'upcoming') q.set('range', rng);
    const qs = q.toString();
    return `/admin/queue${qs ? `?${qs}` : ''}`;
  }

  return (
    <AdminShell user={staffUser} active="dashboard" title="คิวนัดหมายและนัดช่าง">
      <div className="mb-6 space-y-4">
        {/* แถบตัวกรองหมวดหมู่งาน */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">หมวดงาน:</span>
          {[
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'technician', label: 'งานช่างและสาธารณูปโภค' },
            { id: 'government', label: 'งานติดต่อราชการทั่วไป' },
          ].map((c) => (
            <Link
              key={c.id}
              href={filterHref(c.id, activeRange)}
              className={`inline-flex min-h-touch items-center rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === c.id
                  ? 'bg-accent-strong text-on-accent'
                  : 'bg-surface-raised text-ink hover:bg-accent-sunken border border-border'
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>

        {/* แถบตัวกรองช่วงเวลา */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">ช่วงเวลา:</span>
          {[
            { id: 'upcoming', label: 'กำลังจะถึง (Upcoming)' },
            { id: 'today', label: 'วันนี้' },
            { id: 'past', label: 'ย้อนหลัง' },
            { id: 'all', label: 'ทั้งหมด' },
          ].map((r) => (
            <Link
              key={r.id}
              href={filterHref(activeCategory, r.id)}
              className={`inline-flex min-h-touch items-center rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                activeRange === r.id
                  ? 'bg-accent-strong text-on-accent'
                  : 'bg-surface-raised text-ink hover:bg-accent-sunken border border-border'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted">
        รายการคิวนัดหมาย ({bookings.length} รายการ) — ยืนยัน / เสร็จสิ้น / ยกเลิกคิวเพื่อแจ้งให้ประชาชนทราบ
      </p>

      {bookings.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-raised p-8 text-center text-muted">
          ไม่พบคิวนัดหมายตามเงื่อนไขที่เลือก
        </div>
      ) : (
        <>
          {/* Card View สำหรับหน้าจอขนาดเล็ก (Mobile / Tablet < 768px) */}
          <div className="space-y-4 md:hidden">
            {bookings.map((b) => {
              const villageName = b.villageId ? villageNameMap.get(b.villageId) : null;
              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-border bg-surface-raised p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          CATEGORY_BADGE[b.category as QueueCategory] ?? 'bg-surface-sunken text-ink'
                        }`}
                      >
                        {QUEUE_CATEGORY_LABELS[b.category as QueueCategory] ?? b.category}
                      </span>
                      <h3 className="mt-1 font-semibold text-ink">
                        {formatThaiDateLong(new Date(`${b.bookingDate}T00:00:00`))}
                      </h3>
                      <p className="text-xs text-muted">
                        ช่วง: {QUEUE_SLOT_LABELS[b.slot as QueueSlotId] ?? b.slot}
                      </p>
                    </div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                        STATUS_BADGE[b.status as QueueBookingStatus]
                      }`}
                    >
                      {QUEUE_BOOKING_STATUS_LABELS[b.status as QueueBookingStatus]}
                    </span>
                  </div>

                  <div className="my-3 space-y-1.5 text-sm">
                    <div>
                      <span className="text-muted">ผู้จอง: </span>
                      <span className="font-medium text-ink">{b.fullName}</span>
                      <span className="mx-2 text-muted">·</span>
                      <a
                        href={`tel:${b.phoneNumber}`}
                        className="font-medium text-accent-strong hover:underline"
                      >
                        {b.phoneNumber}
                      </a>
                    </div>
                    <div>
                      <span className="text-muted">เรื่อง: </span>
                      <span className="font-semibold text-ink">{b.serviceType}</span>
                    </div>
                    {villageName && (
                      <div className="text-xs text-muted">
                        สถานที่/หมู่บ้าน: <span className="font-medium text-ink">{villageName}</span>
                      </div>
                    )}
                    {b.note && (
                      <div className="text-xs text-muted">
                        รายละเอียด: <span className="text-ink">{b.note}</span>
                      </div>
                    )}
                    {b.adminNote && (
                      <div className="rounded-md bg-surface-sunken p-2 text-xs">
                        <span className="font-semibold">โน้ตเจ้าหน้าที่: </span>
                        <span>{b.adminNote}</span>
                      </div>
                    )}
                    {b.lineUserIdEnc && (
                      <div className="text-xs">
                        <span className="text-muted">การแจ้งเตือน LINE: </span>
                        <span
                          className={
                            b.lineNotificationStatus === 'sent'
                              ? 'font-medium text-success-ink'
                              : b.lineNotificationStatus === 'failed'
                                ? 'font-medium text-danger-ink'
                                : 'font-medium text-accent-strong'
                          }
                        >
                          {b.lineNotificationStatus === 'sent'
                            ? 'ส่งแล้ว'
                            : b.lineNotificationStatus === 'failed'
                              ? 'ส่งไม่สำเร็จ'
                              : 'รอดำเนินการ'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-3">
                    <QueueRowForm
                      bookingId={b.id}
                      currentStatus={b.status as QueueBookingStatus}
                      currentNote={b.adminNote}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table View สำหรับหน้าจอ Desktop (>= 768px) */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface-raised md:block">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    วันที่นัด / ช่วงเวลา
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    หมวดงาน
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    ผู้จอง / เบอร์โทร
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    เรื่องที่นัดหมาย / สถานที่
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    สถานะ
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    LINE
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const villageName = b.villageId ? villageNameMap.get(b.villageId) : null;
                  return (
                    <tr key={b.id} className="border-b border-border align-top last:border-0">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-semibold text-ink">
                          {formatThaiDateLong(new Date(`${b.bookingDate}T00:00:00`))}
                        </span>
                        <span className="block text-xs text-muted">
                          {QUEUE_SLOT_LABELS[b.slot as QueueSlotId] ?? b.slot}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            CATEGORY_BADGE[b.category as QueueCategory] ?? 'bg-surface-sunken text-ink'
                          }`}
                        >
                          {b.category === 'technician' ? 'งานช่าง' : 'ติดต่อราชการ'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-ink">{b.fullName}</span>
                        <a
                          href={`tel:${b.phoneNumber}`}
                          className="block text-xs font-medium text-accent-strong hover:underline"
                        >
                          {b.phoneNumber}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-ink">{b.serviceType}</span>
                        {villageName && (
                          <span className="block text-xs text-muted">
                            หมู่บ้าน: {villageName}
                          </span>
                        )}
                        {b.note && <span className="block text-xs text-muted">โน้ต: {b.note}</span>}
                        {b.adminNote && (
                          <span className="mt-1 block rounded bg-surface-sunken p-1 text-xs text-ink">
                            โน้ตภายใน: {b.adminNote}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                            STATUS_BADGE[b.status as QueueBookingStatus]
                          }`}
                        >
                          {QUEUE_BOOKING_STATUS_LABELS[b.status as QueueBookingStatus]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        {b.lineUserIdEnc ? (
                          <span
                            className={
                              b.lineNotificationStatus === 'sent'
                                ? 'font-semibold text-success-ink'
                                : b.lineNotificationStatus === 'failed'
                                  ? 'font-semibold text-danger-ink'
                                  : 'text-muted'
                            }
                          >
                            {b.lineNotificationStatus === 'sent'
                              ? 'ส่งแล้ว'
                              : b.lineNotificationStatus === 'failed'
                                ? 'ล้มเหลว'
                                : 'รอดำเนินการ'}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <QueueRowForm
                          bookingId={b.id}
                          currentStatus={b.status as QueueBookingStatus}
                          currentNote={b.adminNote}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}
