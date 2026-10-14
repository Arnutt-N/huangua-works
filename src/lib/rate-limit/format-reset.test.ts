import { describe, expect, it } from 'vitest';
import { formatReset } from './format-reset';

describe('formatReset', () => {
  it('ต่ำกว่า 60 แสดงวินาที', () => {
    expect(formatReset(45)).toBe('45 วินาที');
  });

  it('ครบ 60 แสดง 1 นาที', () => {
    expect(formatReset(60)).toBe('1 นาที');
  });

  it('เศษวินาทีปัดขึ้น — ไม่บอกน้อยกว่าเวลารอจริง', () => {
    expect(formatReset(61)).toBe('2 นาที');
    expect(formatReset(899)).toBe('15 นาที');
  });

  it('ค่าหน้าต่างมาตรฐานแสดงนาทีเต็ม', () => {
    expect(formatReset(300)).toBe('5 นาที');
    expect(formatReset(600)).toBe('10 นาที');
    expect(formatReset(900)).toBe('15 นาที');
  });

  it('ค่าผิดปกติ clamp — ไม่หลุด NaN/ลบ/ทศนิยมถึงผู้ใช้', () => {
    expect(formatReset(0)).toBe('0 วินาที');
    expect(formatReset(-5)).toBe('0 วินาที');
    expect(formatReset(45.7)).toBe('45 วินาที');
    expect(formatReset(NaN)).toBe('0 วินาที');
  });
});
