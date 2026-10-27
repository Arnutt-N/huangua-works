'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth/require-staff';
import { getDb } from '@/lib/db';
import { queueBookings } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
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
  let booking;
  try {
    booking = await firstOrUndefined(
      db.select().from(queueBookings).where(eq(queueBookings.id, id)).limit(1),
    );
  } catch (err) {
    console.error('[queue] read failed', err);
    return { error: 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่' };
  }
  if (!booking) return { error: 'ไม่พบคิวที่ระบุ' };

  const from = booking.status as QueueBookingStatus;
  if (!QUEUE_TRANSITIONS[from].includes(status)) {
    return {
      error: `เปลี่ยนจาก “${QUEUE_BOOKING_STATUS_LABELS[from]}” เป็น “${QUEUE_BOOKING_STATUS_LABELS[status]}” ไม่ได้`,
    };
  }

  try {
    await db
      .update(queueBookings)
      .set({ status, adminNote: adminNote || null, updatedAt: new Date() })
      .where(eq(queueBookings.id, id));

    await logAudit(
      {
        userId: auth.user.id,
        action: AUDIT_ACTIONS.QUEUE_BOOKING_UPDATE,
        resource: 'queue_bookings',
        resourceId: id,
        ipAddress: auth.ipAddress,
        userAgent: auth.userAgent,
        metadata: { from, to: status },
      },
      db,
    );
  } catch {
    return { error: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่', success: undefined };
  }

  revalidatePath('/admin/queue');
  return { error: null, success: `อัปเดตคิวเป็น “${QUEUE_BOOKING_STATUS_LABELS[status]}” แล้ว` };
}
