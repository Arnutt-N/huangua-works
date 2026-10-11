import { describe, expect, it } from 'vitest';
import { ALL_BUDGET_STATUSES, BUDGET_LABELS_TH, isBudgetStatus } from './budget';

/** pure module — ตรวจค่าคงที่และป้ายภาษาไทยที่ UI/seed อ้างถึง */

describe('budget · data shape', () => {
  it('มี 3 สถานะตาม brief', () => {
    expect([...ALL_BUDGET_STATUSES]).toEqual(['unspecified', 'has_budget', 'awaiting_budget']);
  });

  it('ป้ายไทยครบทุกสถานะ', () => {
    expect(BUDGET_LABELS_TH).toEqual({
      unspecified: 'ไม่ระบุ',
      has_budget: 'มีงบประมาณ',
      awaiting_budget: 'รองบประมาณ',
    });
  });

  it('type guard รับเฉพาะค่าที่รู้จัก', () => {
    expect(isBudgetStatus('has_budget')).toBe(true);
    expect(isBudgetStatus('awaiting_budget')).toBe(true);
    expect(isBudgetStatus('done')).toBe(false);
    expect(isBudgetStatus('')).toBe(false);
  });
});
