import { describe, expect, it } from 'vitest';
import {
  createQueueBookingSchema,
  queueAvailabilityQuerySchema,
  queueBookingDateSchema,
  queuePhoneSchema,
  queueSlotSchema,
  toLocalISODate,
  QUEUE_BOOKING_WINDOW_DAYS,
} from '@/lib/validation';
import { buildSlotAvailability, isBusinessDay, queueDateRange } from './slots';

/** วันราชการถัดไป (จ–ศ) นับจากพรุ่งนี้ — ใช้เป็นวันที่จองที่ "ผ่านแน่ ๆ" */
function nextBusinessDay(from: Date = new Date()): string {
  const d = new Date(from);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return toLocalISODate(d);
}

/** เสาร์ถัดไป — ใช้เทสว่าวันหยุดถูกปฏิเสธ */
function nextSaturday(from: Date = new Date()): string {
  const d = new Date(from);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== 6);
  return toLocalISODate(d);
}

function shifted(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}

describe('queueBookingDateSchema', () => {
  it('รับวันราชการในกรอบ 30 วัน', () => {
    expect(queueBookingDateSchema.safeParse(nextBusinessDay()).success).toBe(true);
  });

  it('ปฏิเสธรูปแบบที่ไม่ใช่ YYYY-MM-DD', () => {
    for (const bad of ['9/10/2569', '2026-1-1', '2569-10-09', '', 'not-a-date']) {
      const r = queueBookingDateSchema.safeParse(bad);
      expect(r.success, bad).toBe(false);
    }
  });

  it('ปฏิเสธวันที่ไม่มีอยู่จริง (เช่น 30 ก.พ.)', () => {
    expect(queueBookingDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(queueBookingDateSchema.safeParse('2026-13-01').success).toBe(false);
  });

  it('ปฏิเสธวันในอดีต', () => {
    const r = queueBookingDateSchema.safeParse(shifted(-1));
    expect(r.success).toBe(false);
  });

  it(`ปฏิเสธวันที่เกิน +${QUEUE_BOOKING_WINDOW_DAYS} วัน`, () => {
    const r = queueBookingDateSchema.safeParse(shifted(QUEUE_BOOKING_WINDOW_DAYS + 1));
    expect(r.success).toBe(false);
  });

  it('ปฏิเสธวันเสาร์–อาทิตย์', () => {
    const sat = queueBookingDateSchema.safeParse(nextSaturday());
    expect(sat.success).toBe(false);
    if (!sat.success) {
      expect(sat.error.issues[0]?.message).toContain('จันทร์–ศุกร์');
    }
  });
});

describe('queuePhoneSchema', () => {
  it('รับเบอร์มือถือไทย 9–10 หลักขึ้นต้น 0', () => {
    expect(queuePhoneSchema.safeParse('0812345678').success).toBe(true);
    expect(queuePhoneSchema.safeParse('021234567').success).toBe(true);
  });

  it('ปฏิเสธเบอร์ผิดรูปแบบ/ว่าง', () => {
    for (const bad of ['', '12345', '081234567890', 'abc', '+66812345678']) {
      expect(queuePhoneSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe('queueSlotSchema', () => {
  it('รับเฉพาะ slot_1–slot_4', () => {
    expect(queueSlotSchema.safeParse('slot_1').success).toBe(true);
    expect(queueSlotSchema.safeParse('slot_4').success).toBe(true);
    expect(queueSlotSchema.safeParse('morning').success).toBe(false);
    expect(queueSlotSchema.safeParse('slot_5').success).toBe(false);
  });
});

describe('createQueueBookingSchema', () => {
  const valid = {
    fullName: 'สมชาย ใจดี',
    phoneNumber: '0812345678',
    serviceType: 'ไฟฟ้าดับ',
    note: 'เสาหน้าบ้าน',
    bookingDate: nextBusinessDay(),
    slot: 'slot_1',
    consent: true,
  } as const;

  it('รับ payload ครบถ้วน', () => {
    expect(createQueueBookingSchema.safeParse(valid).success).toBe(true);
  });

  it('note ว่างได้ (optional)', () => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest.note;
    expect(createQueueBookingSchema.safeParse(rest).success).toBe(true);
    expect(createQueueBookingSchema.safeParse({ ...valid, note: '' }).success).toBe(true);
  });

  it('บังคับ consent=true', () => {
    const r = createQueueBookingSchema.safeParse({ ...valid, consent: false });
    expect(r.success).toBe(false);
  });
});

describe('queueAvailabilityQuerySchema', () => {
  it('รับ date ที่ถูกต้อง', () => {
    expect(queueAvailabilityQuerySchema.safeParse({ date: nextBusinessDay() }).success).toBe(true);
  });

  it('ปฏิเสธ date หาย/ผิดรูปแบบ', () => {
    expect(queueAvailabilityQuerySchema.safeParse({}).success).toBe(false);
    expect(queueAvailabilityQuerySchema.safeParse({ date: 'เมื่อวาน' }).success).toBe(false);
  });
});

describe('buildSlotAvailability', () => {
  it('ทุกช่วงว่างเมื่อไม่มีการจอง', () => {
    const slots = buildSlotAvailability([]);
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.available)).toBe(true);
    expect(slots.map((s) => s.id)).toEqual(['slot_1', 'slot_2', 'slot_3', 'slot_4']);
  });

  it('ช่วงที่ถูกจองแล้วขึ้นไม่ว่าง ที่เหลือยังว่าง', () => {
    const slots = buildSlotAvailability(['slot_2', 'slot_4']);
    expect(slots.find((s) => s.id === 'slot_2')?.available).toBe(false);
    expect(slots.find((s) => s.id === 'slot_4')?.available).toBe(false);
    expect(slots.find((s) => s.id === 'slot_1')?.available).toBe(true);
    expect(slots.find((s) => s.id === 'slot_3')?.available).toBe(true);
  });

  it('ทุก slot มีป้ายภาษาไทย', () => {
    for (const s of buildSlotAvailability([])) {
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});

describe('queueDateRange / isBusinessDay', () => {
  it('กรอบ = วันนี้ถึง +30 วัน', () => {
    const today = new Date(2026, 9, 8); // 8 ต.ค. 2026 (month 0-based)
    expect(queueDateRange(today)).toEqual({ min: '2026-10-08', max: '2026-11-07' });
  });

  it('แยกวันราชการกับวันหยุดถูก', () => {
    // 9 ต.ค. 2026 = ศุกร์, 10 = เสาร์, 11 = อาทิตย์, 12 = จันทร์
    expect(isBusinessDay('2026-10-09')).toBe(true);
    expect(isBusinessDay('2026-10-10')).toBe(false);
    expect(isBusinessDay('2026-10-11')).toBe(false);
    expect(isBusinessDay('2026-10-12')).toBe(true);
  });

  it('toLocalISODate คืน YYYY-MM-DD ตามเวลาท้องถิ่น', () => {
    expect(toLocalISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
