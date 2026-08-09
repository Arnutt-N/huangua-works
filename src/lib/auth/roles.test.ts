import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLES,
  ALL_ROLES,
  CASE_SUPERVISOR_ROLES,
  STAFF_ROLES,
  SUPERADMIN_ONLY,
  canGrantRole,
  type UserRole,
} from './roles';

describe('auth · ALL_ROLES', () => {
  it('matches the pg enum order (5 roles, citizen first)', () => {
    expect(ALL_ROLES).toEqual(['citizen', 'officer', 'chief', 'head', 'superadmin']);
  });
  it('does not contain the SYSTEM_ACTOR pseudo-role', () => {
    expect(ALL_ROLES).not.toContain('system');
  });
});

describe('auth · STAFF_ROLES', () => {
  it('is ALL_ROLES without citizen', () => {
    expect([...STAFF_ROLES]).toEqual(ALL_ROLES.filter((r) => r !== 'citizen'));
  });
});

describe('auth · role tiers', () => {
  it('SUPERADMIN_ONLY ⊂ ADMIN_ROLES ⊂ CASE_SUPERVISOR_ROLES ⊂ STAFF_ROLES', () => {
    expect(SUPERADMIN_ONLY.every((r) => ADMIN_ROLES.includes(r))).toBe(true);
    expect(ADMIN_ROLES.every((r) => CASE_SUPERVISOR_ROLES.includes(r))).toBe(true);
    expect(CASE_SUPERVISOR_ROLES.every((r) => (STAFF_ROLES as readonly string[]).includes(r))).toBe(
      true,
    );
  });
  it('case tier = chief and above', () => {
    expect(CASE_SUPERVISOR_ROLES).toEqual(['chief', 'head', 'superadmin']);
  });
  it('admin tier = head and above', () => {
    expect(ADMIN_ROLES).toEqual(['head', 'superadmin']);
  });
  it('citizen is in no tier', () => {
    for (const tier of [CASE_SUPERVISOR_ROLES, ADMIN_ROLES, SUPERADMIN_ONLY]) {
      expect(tier).not.toContain('citizen');
    }
  });
});

describe('auth · canGrantRole', () => {
  // ADMIN_ROLES = head|superadmin คือคนที่เรียก createUser/updateUserRole ได้
  // แต่ STAFF_ROLES ที่ zod ยอมรับเป็นค่า role รวม 'superadmin' ด้วย
  // ช่องว่างตรงนี้เคยเปิดให้ head สร้าง/เลื่อนใครก็ได้เป็น superadmin
  const nonSuperadminStaff = STAFF_ROLES.filter((r) => r !== 'superadmin');

  it('lets superadmin grant every role', () => {
    for (const role of ALL_ROLES) {
      expect(canGrantRole('superadmin', role)).toBe(true);
    }
  });

  it.each(nonSuperadminStaff)('stops %s from granting superadmin', (actorRole) => {
    expect(canGrantRole(actorRole, 'superadmin')).toBe(false);
  });

  it('lets head still grant every non-superadmin role', () => {
    for (const role of nonSuperadminStaff) {
      expect(canGrantRole('head', role)).toBe(true);
    }
  });

  it('covers every admin-tier actor — no role that reaches the action bypasses the check', () => {
    // ถ้ามีใครเพิ่ม role ลง ADMIN_ROLES ในอนาคต test นี้จะบังคับให้ตัดสินใจเรื่องนี้ด้วย
    const allowedToGrantSuperadmin = ADMIN_ROLES.filter((r) => canGrantRole(r, 'superadmin'));
    expect(allowedToGrantSuperadmin).toEqual([...SUPERADMIN_ONLY]);
  });

  it('is not fooled by a role string outside the union', () => {
    expect(canGrantRole('officer' as UserRole, 'superadmin')).toBe(false);
    expect(canGrantRole('citizen' as UserRole, 'superadmin')).toBe(false);
  });
});
