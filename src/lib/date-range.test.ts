import { describe, expect, it } from 'vitest';
import {
  STANDARD_DATE_PRESETS,
  customRangeProblem,
  isReversedDateRange,
  presetOptionToDates,
  resolveDateRange,
  toYmd,
  formatDateRangeSummary,
} from './date-range';

describe('date-range helper (Tranche F)', () => {
  it('toYmd คืนค่าสตริง YYYY-MM-DD ถูกต้อง', () => {
    const d = new Date(2026, 9, 31); // 31 Oct 2026 (month index 9 = October)
    expect(toYmd(d)).toBe('2026-10-31');
  });

  it('คำนวณ preset 7 วัน (7d)', () => {
    const mockNow = new Date(2026, 9, 31, 10, 0, 0);
    const opt = STANDARD_DATE_PRESETS.find((p) => p.key === '7d')!;
    const res = presetOptionToDates(opt, mockNow);
    // 7 วัน: ย้อนหลังจาก 31 ต.ค. ไป 7 วัน = 24 ต.ค.
    expect(res).toEqual({
      from: '2026-10-24',
      to: '2026-10-31',
    });
  });

  it('คำนวณ preset 30 วัน (30d)', () => {
    const mockNow = new Date(2026, 9, 31, 10, 0, 0);
    const opt = STANDARD_DATE_PRESETS.find((p) => p.key === '30d')!;
    const res = presetOptionToDates(opt, mockNow);
    expect(res).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('คำนวณ preset 90 วัน (90d)', () => {
    const mockNow = new Date(2026, 9, 31, 10, 0, 0);
    const opt = STANDARD_DATE_PRESETS.find((p) => p.key === '90d')!;
    const res = presetOptionToDates(opt, mockNow);
    expect(res).toEqual({
      from: '2026-08-02',
      to: '2026-10-31',
    });
  });

  it('คำนวณ preset ปีนี้ (year) จาก 1 ม.ค. ของปีปฏิทิน', () => {
    const late = new Date(2026, 9, 31, 10, 0, 0);
    const early = new Date(2026, 2, 15, 10, 0, 0);
    const opt = STANDARD_DATE_PRESETS.find((p) => p.key === 'year')!;
    expect(presetOptionToDates(opt, late)).toEqual({
      from: '2026-01-01',
      to: '2026-10-31',
    });
    expect(presetOptionToDates(opt, early)).toEqual({
      from: '2026-01-01',
      to: '2026-03-15',
    });
  });

  it('resolveDateRange คืน null เมื่อไม่มี preset และไม่มี custom range', () => {
    expect(resolveDateRange(null, '', '')).toBeNull();
  });

  it('resolveDateRange คืนช่วงวันที่ถูกต้องเมื่อ preset เป็น custom ที่กรอกครบ', () => {
    const res = resolveDateRange('custom', '2026-10-05', '2026-10-20');
    expect(res).toEqual({
      from: '2026-10-05',
      to: '2026-10-20',
    });
  });

  it('resolveDateRange คืน null เมื่อ custom กรอกไม่ครบหรือวันเริ่มอยู่หลังวันสิ้นสุด', () => {
    expect(resolveDateRange('custom', '2026-10-05', '')).toBeNull();
    expect(resolveDateRange('custom', '', '2026-10-20')).toBeNull();
    expect(resolveDateRange('custom', '2026-10-20', '2026-10-05')).toBeNull();
  });

  it('customRangeProblem แยกช่วงว่าง ช่วงไม่ครบ และช่วงสลับ', () => {
    expect(customRangeProblem('', '')).toBeNull();
    expect(customRangeProblem('2026-10-01', '')).toBe('incomplete');
    expect(customRangeProblem('', '2026-10-20')).toBe('incomplete');
    expect(customRangeProblem('2026-10-20', '2026-10-05')).toBe('reversed');
    expect(customRangeProblem('2026-10-05', '2026-10-20')).toBeNull();
    expect(customRangeProblem('2026-10-05', '2026-10-05')).toBeNull();
  });

  it('isReversedDateRange เป็นจริงเฉพาะเมื่อมีทั้งคู่และวันเริ่มอยู่หลัง', () => {
    expect(isReversedDateRange('2026-10-20', '2026-10-05')).toBe(true);
    expect(isReversedDateRange('2026-10-05', '2026-10-20')).toBe(false);
    expect(isReversedDateRange('2026-10-05', '')).toBe(false);
    expect(isReversedDateRange(undefined, '2026-10-05')).toBe(false);
  });

  it('formatDateRangeSummary แสดงข้อความสรุปช่วงวันที่ภาษาไทยแบบ พ.ศ.', () => {
    expect(formatDateRangeSummary('2026-10-01', '2026-10-31')).toBe(
      '1 ต.ค. 2569 – 31 ต.ค. 2569',
    );
    expect(formatDateRangeSummary('2026-10-31', '2026-10-31')).toBe('31 ต.ค. 2569');
    expect(formatDateRangeSummary('', '')).toBe('');
  });
});
