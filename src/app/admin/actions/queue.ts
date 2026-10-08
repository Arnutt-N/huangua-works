'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth/require-staff';
import { getDb } from '@/lib/db';
import { queueBookings } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { logAudit, type AuditAction } from '@/lib/audit';
import {
  updateQueueBookingFormSchema,
  validateFormData,
  QUEUE_BOOKING_STATUS_LABELS,
  type QueueBookingStatus,
} from '@/lib/validation';

export interface QueueActionState {
  error: string | null;
  success?: string;
}

// § ชื่อ action สำหรับ audit — เหตุผลเดียวกับ route.ts (ห้ามแตะ audit.ts ใน branch นี้)
// ตอนรวมให้ย้ายเข้า AUDIT_ACTIONS แล้วลบ cast ทิ้ง
const AUDIT_QUEUE_UPDATE = 'queue_booking_update' as AuditAction;

/**
 * ผังสถานะคิว (ตรวจใน action ก่อน update ทุกครั้ง):
 * จองแล้ว → ยืนยันแล้ว/ยกเลิกแล้ว · ยืนยันแล้ว → เสร็จแล้ว/ยกเลิกแล้ว
 * (เสร็จแล้ว/ยกเลิกแล้ว เป็นสถานะปลายทาง)
 */
const QUEUE_TRANSITIONS: Record<QueueBookingStatus, QueueBookingStatus[]> = {
  booked: ['confirmed', 'cancelled'],
  confirmed: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};

export async function updateQueueBooking(
  _prevState: QueueActionState,
  formData: FormData,
): Promise<QueueActionState> {
  const auth = await requireStaff();
  const v = validateFormData(updateQueueBookingFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { id, status, adminNote } = v.data;

  const db = await getDb();
  const booking = await firstOrUndefined(
    db.select().from(queueBookings).where(eq(queueBookings.id, id)).limit(1),
  );
  if (!booking) return { error: 'ไม่พบคิวที่ระบุ' };

  const from = booking.status as QueueBookingStatus;
  if (!QUEUE_TRANSITIONS[from].includes(status)) {
    return {
      error: `เปลี่ยนจาก “${QUEUE_BOOKING_STATUS_LABELS[from]}” เป็น “${QUEUE_BOOKING_STATUS_LABELS[status]}” ไม่ได้`,
    };
  }

  await db
    .update(queueBookings)
    .set({ status, adminNote: adminNote || null, updatedAt: new Date() })
    .where(eq(queueBookings.id, id));

  await logAudit(
    {
      userId: auth.user.id,
      action: AUDIT_QUEUE_UPDATE,
      resource: 'queue_bookings',
      resourceId: id,
      ipAddress: auth.ipAddress,
      userAgent: auth.userAgent,
      metadata: { from, to: status },
    },
    db,
  );

  revalidatePath('/admin/queue');
  return { error: null, success: `อัปเดตคิวเป็น “${QUEUE_BOOKING_STATUS_LABELS[status]}” แล้ว` };
}
