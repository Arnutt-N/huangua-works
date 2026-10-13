import { describe, expect, test } from 'vitest';
import { resolveInitialCategoryId, type IntakeCategory } from './intake-form';

const CATS: IntakeCategory[] = [
  { id: 'c1', name: 'ถนน-ทางเท้า', slug: 'roads-sidewalks' },
  { id: 'c2', name: 'น้ำประปา', slug: 'water-supply' },
];

describe('resolveInitialCategoryId', () => {
  test('slug ตรง → ได้ id หมวดนั้น', () => {
    expect(resolveInitialCategoryId(CATS, 'water-supply')).toBe('c2');
  });

  test('slug ผิด → ว่าง', () => {
    expect(resolveInitialCategoryId(CATS, 'nope')).toBe('');
  });

  test('slug หมวด inactive (ไม่อยู่ในรายการ) → ว่าง', () => {
    expect(resolveInitialCategoryId(CATS, 'drainage')).toBe('');
  });

  test('ไม่ส่ง slug / ค่าว่าง → ว่าง', () => {
    expect(resolveInitialCategoryId(CATS, undefined)).toBe('');
    expect(resolveInitialCategoryId(CATS, '')).toBe('');
  });

  test('หมวดไม่มี slug → ไม่ match', () => {
    expect(resolveInitialCategoryId([{ id: 'c9', name: 'อื่นๆ' }], 'others')).toBe('');
  });
});
