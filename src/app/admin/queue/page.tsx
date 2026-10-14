import type { Metadata } from 'next';
import { asc, gte } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { queueBookings } from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminShell } from '@/components/admin/admin-shell';
import { formatThaiDateLong } from '@/lib/thai-date';
import {
  QUEUE_BOOKING_STATUS_LABELS,
  QUEUE_SLOT_LABELS,
  toLocalISODate,
  type QueueBookingStatus,
  type QueueSlotId,
} from '@/lib/validation';
import { QueueRowForm } from './queue-row-form';

export const metadata: Metadata = { title: 'คิวนัดช่าง' };
export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<QueueBookingStatus, string> = {
  booked: 'bg-accent-sunken text-accent-strong',
  confirmed: 'bg-success-soft text-success-ink',
  done: 'bg-surface-raised text-muted ring-1 ring-inset ring-border',
  cancelled: 'bg-danger-soft text-danger-ink',
};

/**
 * /admin/queue — เจ้าหน้าที่ดูคิวนัดช่างล่วงหน้า + เปลี่ยนสถานะ/โน้ต (P2-03)
 *
 * § active="dashboard" ชั่วคราว — ยังไม่มี tab คิวนัดช่างใน admin-nav (ไฟล์นั้นอยู่นอก
 * ขอบเขต branch นี้) ตอนรวมค่อยเพิ่ม nav item แล้วเปลี่ยน active ให้ตรง
 */
export default async function AdminQueuePage() {
  const { user: staffUser } = await requireStaff();
  const db = await getDb();

  // § คิววันนี้ขึ้นไป เรียงวันแล้วช่วง — เทียบสตริง YYYY-MM-DD ตรง ๆ (zero-padded)
  const bookings = await db
    .select()
    .from(queueBookings)
    .where(gte(queueBookings.bookingDate, toLocalISODate(new Date())))
    .orderBy(asc(queueBookings.bookingDate), asc(queueBookings.slot))
    .limit(100);

  return (
    <AdminShell user={staffUser} active="dashboard" title="คิวนัดช่าง">
      <p className="mb-4 text-muted">
        คิวนัดที่ยังไม่ถึงวัน ({bookings.length} รายการ) — ยืนยัน/เสร็จ/ยกเลิกคิวจากตารางด้านล่าง
      </p>
      {bookings.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-raised p-6 text-center text-muted">
          ยังไม่มีคิวนัดช่างในช่วงนี้
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-raised">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th scope="col" className="px-4 py-3 font-semibold">วันที่นัด</th>
                <th scope="col" className="px-4 py-3 font-semibold">ช่วงเวลา</th>
                <th scope="col" className="px-4 py-3 font-semibold">ผู้จอง</th>
                <th scope="col" className="px-4 py-3 font-semibold">เบอร์โทร</th>
                <th scope="col" className="px-4 py-3 font-semibold">งานช่าง</th>
                <th scope="col" className="px-4 py-3 font-semibold">สถานะ</th>
                <th scope="col" className="px-4 py-3 font-semibold">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-border align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">
                    {formatThaiDateLong(new Date(`${b.bookingDate}T00:00:00`))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {QUEUE_SLOT_LABELS[b.slot as QueueSlotId] ?? b.slot}
                  </td>
                  <td className="px-4 py-3">{b.fullName}</td>
                  <td className="whitespace-nowrap px-4 py-3">{b.phoneNumber}</td>
                  <td className="px-4 py-3">
                    {b.serviceType}
                    {b.note && <span className="block text-muted">{b.note}</span>}
                    {b.adminNote && (
                      <span className="block text-muted">โน้ต: {b.adminNote}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[b.status as QueueBookingStatus]}`}
                    >
                      {QUEUE_BOOKING_STATUS_LABELS[b.status as QueueBookingStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <QueueRowForm
                      bookingId={b.id}
                      currentStatus={b.status as QueueBookingStatus}
                      currentNote={b.adminNote}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
