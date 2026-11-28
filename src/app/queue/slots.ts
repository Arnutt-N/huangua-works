import {
  QUEUE_BOOKING_WINDOW_DAYS,
  QUEUE_SLOT_IDS,
  QUEUE_SLOT_LABELS,
  addCalendarDays,
  toLocalISODate,
  type QueueSlotId,
} from '@/lib/validation';

/**
 * ตัวช่วยจองคิวนัดช่าง (pure — ไม่มี next/* ใช้ได้ทั้ง route handler, หน้า UI และ test)
 */

export interface QueueSlotAvailability {
  id: QueueSlotId;
  label: string;
  available: boolean;
}

/**
 * ประกอบตารางช่วงว่างของวันจากรายการ slot ที่ถูกจองแล้ว
 * (slot ที่จองแล้ว = มีแถว queue_bookings ที่ status ไม่ใช่ cancelled)
 */
export function buildSlotAvailability(bookedSlots: Iterable<string>): QueueSlotAvailability[] {
  const booked = new Set(bookedSlots);
  return QUEUE_SLOT_IDS.map((id) => ({
    id,
    label: QUEUE_SLOT_LABELS[id],
    available: !booked.has(id),
  }));
}

/**
 * กรอบวันที่จองได้สำหรับ date input (min/max) — วันนี้ถึง +30 วัน
 * รับ `today` ไว้เทส (default = วันนี้ตามเวลาท้องถิ่น)
 */
export function queueDateRange(today: Date = new Date()): { min: string; max: string } {
  return { min: toLocalISODate(today), max: toLocalISODate(addCalendarDays(today, QUEUE_BOOKING_WINDOW_DAYS)) };
}

/** วันนี้เป็นวันราชการ (จันทร์–ศุกร์) หรือไม่ — ใช้เตือนใน UI (server ตรวจซ้ำเสมอ) */
export function isBusinessDay(isoDate: string): boolean {
  // § UTC weekday ของตัวอักษร YYYY-MM-DD — ห้าม getDay() ที่เขตเวลาเครื่องรัน
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}
