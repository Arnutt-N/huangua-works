import { describe, expect, test } from 'vitest';
import { calculateBudgetUtilization, checkBudgetAvailable, formatBaht, type BudgetItem } from './budget-validation';

function makeBudget(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    fiscalYear: 2569,
    categoryId: 'cat-1',
    departmentId: 'dept-1',
    allocated: 100_000,
    spent: 0,
    reserved: 0,
    ...overrides,
  };
}

describe('checkBudgetAvailable', () => {
  test('is available when requested amount fits within remaining budget', () => {
    const budget = makeBudget({ allocated: 100_000, spent: 20_000, reserved: 10_000 });
    const result = checkBudgetAvailable(budget, 50_000);
    expect(result.available).toBe(true);
    expect(result.remaining).toBe(70_000);
  });

  test('is not available when requested amount exceeds remaining budget', () => {
    const budget = makeBudget({ allocated: 100_000, spent: 90_000, reserved: 5_000 });
    const result = checkBudgetAvailable(budget, 10_000);
    expect(result.available).toBe(false);
    expect(result.remaining).toBe(5_000);
  });

  test('treats an exact match as available (>= boundary)', () => {
    const budget = makeBudget({ allocated: 100_000, spent: 40_000, reserved: 10_000 });
    const result = checkBudgetAvailable(budget, 50_000);
    expect(result.available).toBe(true);
    expect(result.remaining).toBe(50_000);
  });

  test('remaining can go negative when spent+reserved exceed allocation', () => {
    const budget = makeBudget({ allocated: 100_000, spent: 90_000, reserved: 20_000 });
    const result = checkBudgetAvailable(budget, 1);
    expect(result.available).toBe(false);
    expect(result.remaining).toBe(-10_000);
  });
});

describe('calculateBudgetUtilization', () => {
  test('returns 0 when nothing has been spent or reserved', () => {
    expect(calculateBudgetUtilization(makeBudget({ allocated: 100_000 }))).toBe(0);
  });

  test('returns 100 when fully utilized', () => {
    expect(calculateBudgetUtilization(makeBudget({ allocated: 100_000, spent: 100_000 }))).toBe(100);
  });

  test('sums spent and reserved as a percentage of allocated', () => {
    expect(
      calculateBudgetUtilization(makeBudget({ allocated: 100_000, spent: 30_000, reserved: 20_000 }))
    ).toBe(50);
  });

  test('returns 0 when allocated is 0 (avoids division by zero)', () => {
    expect(calculateBudgetUtilization(makeBudget({ allocated: 0, spent: 0, reserved: 0 }))).toBe(0);
  });

  test('can exceed 100 when over-utilized', () => {
    expect(calculateBudgetUtilization(makeBudget({ allocated: 100_000, spent: 120_000 }))).toBe(120);
  });
});

describe('formatBaht', () => {
  test('formats a whole number as Thai currency', () => {
    expect(formatBaht(1000)).toContain('1,000');
  });

  test('includes the Thai currency symbol', () => {
    expect(formatBaht(500)).toMatch(/฿/);
  });

  test('formats zero', () => {
    expect(formatBaht(0)).toContain('0');
  });
});
