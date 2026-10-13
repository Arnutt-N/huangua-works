import { describe, expect, test } from 'vitest';
import { pickTierRoles } from './tiers';
import { ADMIN_ROLES } from './roles';

describe('pickTierRoles', () => {
  test('มีแถว DB → ใช้ค่าจาก DB', () => {
    expect(pickTierRoles(['officer', 'superadmin'], ADMIN_ROLES)).toEqual(['officer', 'superadmin']);
  });

  test('ไม่มีแถว → fallback ค่าคงที่ (roles.ts ยังเป็น truth เดิม)', () => {
    expect(pickTierRoles(undefined, ADMIN_ROLES)).toEqual([...ADMIN_ROLES]);
  });

  test('แถวว่าง → fallback (ไม่ล็อกทั้งระบบ)', () => {
    expect(pickTierRoles([], ADMIN_ROLES)).toEqual([...ADMIN_ROLES]);
  });
});
