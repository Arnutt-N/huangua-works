import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from './format';

const NOW = Date.UTC(2026, 9, 23, 4, 0, 0);
function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

describe('formatRelativeTime', () => {
  it('น้อยกว่า 1 นาที = เมื่อสักครู่', () => {
    vi.setSystemTime(NOW);
    expect(formatRelativeTime(ago(30_000))).toBe('เมื่อสักครู่');
  });

  it('นาที — 5 นาทีที่แล้ว', () => {
    vi.setSystemTime(NOW);
    expect(formatRelativeTime(ago(5 * 60_000))).toBe('5 นาทีที่แล้ว');
  });

  it('ชั่วโมง — 3 ชั่วโมงที่แล้ว', () => {
    vi.setSystemTime(NOW);
    expect(formatRelativeTime(ago(3 * 3_600_000))).toBe('3 ชั่วโมงที่แล้ว');
  });

  it('วัน — 2 วันที่แล้ว', () => {
    vi.setSystemTime(NOW);
    expect(formatRelativeTime(ago(2 * 86_400_000))).toBe('2 วันที่แล้ว');
  });

  it('เดือน — 2 เดือนที่แล้ว', () => {
    vi.setSystemTime(NOW);
    expect(formatRelativeTime(ago(60 * 86_400_000))).toBe('2 เดือนที่แล้ว');
  });

  it('ปี — 1 ปีที่แล้ว', () => {
    vi.setSystemTime(NOW);
    expect(formatRelativeTime(ago(400 * 86_400_000))).toBe('1 ปีที่แล้ว');
  });

  it('อนาคต (เวลาเบี้ยว) = เมื่อสักครู่ ไม่ติดลบ', () => {
    vi.setSystemTime(NOW);
    expect(formatRelativeTime(new Date(NOW + 60_000).toISOString())).toBe('เมื่อสักครู่');
  });

  it('null = สตริงว่าง', () => {
    expect(formatRelativeTime(null)).toBe('');
  });
});
