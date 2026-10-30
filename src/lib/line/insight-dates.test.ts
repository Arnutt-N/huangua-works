import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRichMenuInsightDaily, getRichMenuInsightSummary } from './client';
import { validateInsightDailyRange, validateInsightRange } from './insight-dates';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validateInsightRange', () => {
  it('รับช่วงปกติ', () => {
    expect(validateInsightRange('20260101', '20260131')).toBeNull();
  });

  it('รูปแบบผิด', () => {
    expect(validateInsightRange('2026-01-01', '20260131')).toContain('yyyyMMdd');
    expect(validateInsightRange('20261301', '20260131')).toContain('yyyyMMdd');
  });

  it('from หลัง to', () => {
    expect(validateInsightRange('20260201', '20260101')).toContain('วันเริ่ม');
  });

  it('เกิน 396 วัน (summary)', () => {
    expect(validateInsightRange('20240101', '20260101')).toContain('396');
  });
});

describe('validateInsightDailyRange', () => {
  it('รายวันจำกัด 99 วัน', () => {
    expect(validateInsightDailyRange('20260101', '20260131')).toBeNull();
    expect(validateInsightDailyRange('20260101', '20260601')).toContain('99');
  });
});

describe('getRichMenuInsight 404 fallback', () => {
  it('คืนโครงสร้างว่างพร้อม privacy_restricted: true เมื่อ LINE ตอบ 404 (เมนูใหม่ยังไม่มีสถิติสะสม)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Not found' }), { status: 404 }),
    );

    const summary = await getRichMenuInsightSummary('richmenu-new', '20261001', '20261030');
    expect(summary).toEqual({
      rich_menu_id: 'richmenu-new',
      metrics_from: null,
      metrics_to: null,
      impression: null,
      clicks: null,
      privacy_restricted: true,
    });

    const daily = await getRichMenuInsightDaily('richmenu-new', '20261001', '20261030');
    expect(daily).toEqual({
      rich_menu_id: 'richmenu-new',
      metrics_from: null,
      metrics_to: null,
      impression: null,
      clicks: null,
      privacy_restricted: true,
    });
  });
});
