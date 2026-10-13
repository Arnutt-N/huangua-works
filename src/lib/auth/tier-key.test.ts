import { describe, expect, test } from 'vitest';
import { tierKeyForRoles } from './tiers';
import { ADMIN_ROLES } from './roles';

describe('tierKeyForRoles', () => {
  test('array เดิม → เจอ key', () => {
    expect(tierKeyForRoles(ADMIN_ROLES)).toBe('admin');
  });

  test('spread สำเนา → เจอ key เหมือนกัน (ไม่หลุด matrix)', () => {
    expect(tierKeyForRoles([...ADMIN_ROLES])).toBe('admin');
  });

  test('literal เทียบเท่า → เจอ key', () => {
    expect(tierKeyForRoles(['head', 'superadmin'])).toBe('admin');
  });

  test('array แปลกหน้า → undefined (ผ่านตรงเหมือนเดิม)', () => {
    expect(tierKeyForRoles(['officer'])).toBeUndefined();
  });
});
