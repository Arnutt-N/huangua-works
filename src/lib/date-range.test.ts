import { describe, expect, it } from 'vitest';
import {
  STANDARD_DATE_PRESETS,
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

  it('คำนวณ preset วันนี้ (today)', () => {
    const mockNow = new Date(2026, 9, 31, 10, 0, 0);
    const opt = STANDARD_DATE_PRESETS.find((p) => p.key === 'today')!;
    const res = presetOptionToDates(opt, mockNow);
    expect(res).toEqual({
      from: '2026-10-31',
      to: '2026-10-31',
    });
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

  it('คำนวณ preset ปีงบประมาณนี้ (fiscal) ในช่วงหลัง 1 ต.ค. (เช่น 31 ต.ค. 2026)', () => {
    const mockNow = new Date(2026, 9, 31, 10, 0, 0); // ต.ค. 2026 -> ปีงบ 2570 เริ่ม 1 ต.ค. 2026
    const opt = STANDARD_DATE_PRESETS.find((p) => p.key === 'fiscal')!;
    const res = presetOptionToDates(opt, mockNow);
    expect(res).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('คำนวณ preset ปีงบประมาณนี้ (fiscal) ในช่วงก่อน 1 ต.ค. (เช่น 15 มี.ค. 2026)', () => {
    const mockNow = new Date(2026, 2, 15, 10, 0, 0); // 15 มี.ค. 2026 -> เริ่ม 1 ต.ค. 2025
    const opt = STANDARD_DATE_PRESETS.find((p) => p.key === 'fiscal')!;
    const res = presetOptionToDates(opt, mockNow);
    expect(res).toEqual({
      from: '2025-10-01',
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

  it('resolveDateRange คืน null เมื่อ custom กรอกไม่ครบสองช่อง', () => {
    expect(resolveDateRange('custom', '2026-10-05', '')).toBeNull();
    expect(resolveDateRange('custom', '', '2026-10-20')).toBeNull();
  });

  it('formatDateRangeSummary แสดงข้อความสรุปช่วงวันที่ภาษาไทยแบบ พ.ศ.', () => {
    expect(formatDateRangeSummary('2026-10-01', '2026-10-31')).toBe(
      '1 ต.ค. 2569 – 31 ต.ค. 2569',
    );
    expect(formatDateRangeSummary('2026-10-31', '2026-10-31')).toBe('31 ต.ค. 2569');
    expect(formatDateRangeSummary('', '')).toBe('');
  });
});
