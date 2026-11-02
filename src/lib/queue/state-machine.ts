/**
 * src/lib/queue/state-machine.ts
 *
 * Single Source of Truth สำหรับหมวดหมู่และวงจรสถานะการจองคิวนัดหมาย (Queue and Appointment)
 * โมดูลนี้เป็น pure module (ห้าม import อะไรเลย) เพื่อให้ปลอดภัยทั้งใน client bundle,
 * server components/actions, และ Drizzle schema.ts
 */

export const ALL_QUEUE_CATEGORIES = ['technician', 'government'] as const;
export type QueueCategory = (typeof ALL_QUEUE_CATEGORIES)[number];

export const QUEUE_CATEGORY_LABELS: Record<QueueCategory, string> = {
  technician: 'งานช่างและบริการสาธารณูปโภค (ลงพื้นที่)',
  government: 'งานติดต่อราชการทั่วไป (ณ ที่ทำการ อบต.)',
} as const;

export const QUEUE_CATEGORY_SHORT_LABELS: Record<QueueCategory, string> = {
  technician: 'งานช่าง',
  government: 'ติดต่อราชการ',
} as const;

export const ALL_QUEUE_BOOKING_STATUSES = ['booked', 'confirmed', 'done', 'cancelled'] as const;
export type QueueBookingStatus = (typeof ALL_QUEUE_BOOKING_STATUSES)[number];

export const QUEUE_BOOKING_STATUS_LABELS: Record<QueueBookingStatus, string> = {
  booked: 'จองแล้ว',
  confirmed: 'ยืนยันแล้ว',
  done: 'เสร็จแล้ว',
  cancelled: 'ยกเลิกแล้ว',
} as const;

/**
 * แผนภาพการเปลี่ยนสถานะการจองคิว:
 * booked -> confirmed, cancelled
 * confirmed -> done, cancelled
 * done -> (terminal)
 * cancelled -> (terminal)
 */
export const QUEUE_TRANSITIONS: Record<QueueBookingStatus, readonly QueueBookingStatus[]> = {
  booked: ['confirmed', 'cancelled'],
  confirmed: ['done', 'cancelled'],
  done: [],
  cancelled: [],
} as const;

export function canTransitionQueueStatus(
  from: QueueBookingStatus,
  to: QueueBookingStatus,
): boolean {
  return QUEUE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertQueueTransition(
  from: QueueBookingStatus,
  to: QueueBookingStatus,
): { ok: true } | { ok: false; reason: string } {
  if (from === to) {
    return { ok: false, reason: 'สถานะปัจจุบันเป็นสถานะนี้อยู่แล้ว' };
  }
  if (!canTransitionQueueStatus(from, to)) {
    return {
      ok: false,
      reason: `เปลี่ยนจาก “${QUEUE_BOOKING_STATUS_LABELS[from]}” เป็น “${QUEUE_BOOKING_STATUS_LABELS[to]}” ไม่ได้`,
    };
  }
  return { ok: true };
}
