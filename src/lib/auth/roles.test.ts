import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLES,
  ALL_ROLES,
  CASE_SUPERVISOR_ROLES,
  STAFF_ROLES,
  SUPERADMIN_ONLY,
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
