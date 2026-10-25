import { describe, expect, it } from 'vitest';
import { validateInsightDailyRange, validateInsightRange } from './insight-dates';

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
