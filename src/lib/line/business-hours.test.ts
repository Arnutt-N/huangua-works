import { describe, expect, it } from 'vitest';
import {
  BUSINESS_DAY_LABELS,
  bangkokClock,
  formatBusinessHours,
  isWithinBusinessHours,
  outsideBusinessHoursText,
  parseClockMinutes,
  type BusinessHours,
} from './business-hours';

const WEEKDAYS: BusinessHours = { start: '08:30', end: '16:30', days: [1, 2, 3, 4, 5] };

// fixture ทั้งหมดเขียนเป็น UTC (Z) เพื่อให้ผลไม่ขึ้นกับ TZ ของเครื่องที่รันเทสต์
// 2026-10-05 = วันจันทร์, 2026-10-10 = วันเสาร์ (เวลาไทย)
const MON_0830_TH = new Date('2026-10-05T01:30:00Z');
const MON_0829_TH = new Date('2026-10-05T01:29:00Z');
const MON_1629_TH = new Date('2026-10-05T09:29:00Z');
const MON_1630_TH = new Date('2026-10-05T09:30:00Z');
const SAT_1000_TH = new Date('2026-10-10T03:00:00Z');
const MON_0030_TH_BUT_SUN_UTC = new Date('2026-10-04T17:30:00Z');
const SAT_0030_TH_BUT_FRI_UTC = new Date('2026-10-09T17:30:00Z');

describe('parseClockMinutes', () => {
  it.each([
    ['00:00', 0],
    ['08:30', 510],
    ['23:59', 1439],
    ['24:00', 1440],
  ])('แปลง %s เป็น %i นาที', (input, expected) => {
    expect(parseClockMinutes(input)).toBe(expected);
  });

  it.each(['24:01', '25:00', '08:60', '8:30', '0830', '', null, undefined, 830])(
    'คืน null สำหรับค่าที่ไม่ใช่ HH:MM ที่ถูกต้อง (%s)',
    (input) => {
      expect(parseClockMinutes(input)).toBeNull();
    },
  );
});

describe('bangkokClock', () => {
  it('ใช้วันและเวลาตามเวลาไทย ไม่ใช่ UTC', () => {
    expect(bangkokClock(MON_0030_TH_BUT_SUN_UTC)).toEqual({ day: 1, minutes: 30 });
    expect(bangkokClock(SAT_0030_TH_BUT_FRI_UTC)).toEqual({ day: 6, minutes: 30 });
  });
});

describe('isWithinBusinessHours', () => {
  it('เวลาเปิดนับรวม (08:30 = อยู่ในเวลา)', () => {
    expect(isWithinBusinessHours(WEEKDAYS, MON_0830_TH)).toBe(true);
  });

  it('ก่อนเวลาเปิดหนึ่งนาที = นอกเวลา', () => {
    expect(isWithinBusinessHours(WEEKDAYS, MON_0829_TH)).toBe(false);
  });

  it('เวลาปิดไม่นับรวม (16:29 อยู่ในเวลา, 16:30 นอกเวลา)', () => {
    expect(isWithinBusinessHours(WEEKDAYS, MON_1629_TH)).toBe(true);
    expect(isWithinBusinessHours(WEEKDAYS, MON_1630_TH)).toBe(false);
  });

  it('วันที่ไม่อยู่ใน days = นอกเวลา', () => {
    expect(isWithinBusinessHours(WEEKDAYS, SAT_1000_TH)).toBe(false);
  });

  it('ตัดสินวันด้วยวันตามเวลาไทย', () => {
    const mondayAllDay: BusinessHours = { start: '00:00', end: '24:00', days: [1] };
    const sundayAllDay: BusinessHours = { start: '00:00', end: '24:00', days: [0] };
    expect(isWithinBusinessHours(mondayAllDay, MON_0030_TH_BUT_SUN_UTC)).toBe(true);
    expect(isWithinBusinessHours(sundayAllDay, MON_0030_TH_BUT_SUN_UTC)).toBe(false);
    expect(isWithinBusinessHours(WEEKDAYS, SAT_0030_TH_BUT_FRI_UTC)).toBe(false);
  });

  it("'24:00' ครอบคลุมถึงสิ้นวัน", () => {
    const allDay: BusinessHours = { start: '00:00', end: '24:00', days: [0, 1, 2, 3, 4, 5, 6] };
    expect(isWithinBusinessHours(allDay, new Date('2026-10-05T16:59:00Z'))).toBe(true); // 23:59 ไทย
  });

  it('days ว่าง = ปิดทุกวัน', () => {
    expect(isWithinBusinessHours({ ...WEEKDAYS, days: [] }, MON_1629_TH)).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['days ไม่ใช่ array', { start: '08:30', end: '16:30', days: 'จันทร์' } as unknown as BusinessHours],
    ['start ผิดรูป', { ...WEEKDAYS, start: '8.30' }],
    ['start >= end', { ...WEEKDAYS, start: '16:30', end: '08:30' }],
  ])('§ ค่าเสีย (%s) → fail-open ถือว่าอยู่ในเวลาทำการ', (_label, hours) => {
    expect(isWithinBusinessHours(hours, SAT_1000_TH)).toBe(true);
  });
});

describe('formatBusinessHours / outsideBusinessHoursText', () => {
  it('ป้ายชื่อวันเรียงตาม getDay (0 = อาทิตย์)', () => {
    expect(BUSINESS_DAY_LABELS[0]).toBe('อา');
    expect(BUSINESS_DAY_LABELS[1]).toBe('จ');
    expect(BUSINESS_DAY_LABELS[6]).toBe('ส');
  });

  it('จัดรูปวัน (เรียง, ไม่ซ้ำ) และช่วงเวลา', () => {
    expect(formatBusinessHours({ start: '08:30', end: '16:30', days: [5, 1, 3, 1] })).toBe(
      'วัน จ, พ, ศ เวลา 08:30–16:30 น.',
    );
  });

  it('days ว่าง → บอกว่ายังไม่ได้กำหนดวันทำการ', () => {
    expect(formatBusinessHours({ ...WEEKDAYS, days: [] })).toBe('ยังไม่ได้กำหนดวันทำการ');
  });

  it('ข้อความนอกเวลาบอกเวลาทำการและคำสั่งที่บอทยังทำได้', () => {
    const text = outsideBusinessHoursText(WEEKDAYS);
    expect(text).toContain('นอกเวลาทำการ');
    expect(text).toContain('วัน จ, อ, พ, พฤ, ศ เวลา 08:30–16:30 น.');
    expect(text).toContain('แจ้งเรื่องใหม่');
    expect(text).toContain('ติดตาม HG');
  });
});
