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
  assertQueueTransition,
  QUEUE_BOOKING_STATUS_LABELS,
  type QueueBookingStatus,
  type QueueCategory,
} from '@/lib/validation';
import { sendQueueBookingStatusUpdate } from '@/lib/line/notify/queue-booking-notify';

export interface QueueActionState {
  error: string | null;
  success?: string;
}

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
  const transition = assertQueueTransition(from, status);
  if (!transition.ok) {
    return { error: transition.reason };
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
        metadata: { from, to: status, hasLineNotify: !!booking.lineUserIdEnc },
      },
      db,
    );
  } catch {
    return { error: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่', success: undefined };
  }

  // § Non-blocking LINE notification dispatch เมื่อแอดมินเปลี่ยนสถานะคิว
  if (booking.lineUserIdEnc) {
    sendQueueBookingStatusUpdate(
      {
        id: booking.id,
        fullName: booking.fullName,
        phoneNumber: booking.phoneNumber,
        category: booking.category as QueueCategory,
        serviceType: booking.serviceType,
        bookingDate: booking.bookingDate,
        slot: booking.slot,
        note: booking.note,
        lineUserIdEnc: booking.lineUserIdEnc,
      },
      status,
      adminNote,
    )
      .then(async (sent) => {
        try {
          await db
            .update(queueBookings)
            .set({
              lineNotificationStatus: sent ? 'sent' : 'failed',
              lineNotificationAt: new Date(),
            })
            .where(eq(queueBookings.id, id));
        } catch (err) {
          console.warn('[admin-queue] failed to update notification status', err);
        }
      })
      .catch((err) => console.warn('[admin-queue] failed to send LINE status notification', err));
  }

  revalidatePath('/admin/queue');
  const notifySuffix = booking.lineUserIdEnc ? ' (พร้อมส่งแจ้งเตือนทาง LINE)' : '';
  return {
    error: null,
    success: `อัปเดตคิวเป็น “${QUEUE_BOOKING_STATUS_LABELS[status]}” แล้ว${notifySuffix}`,
  };
}
