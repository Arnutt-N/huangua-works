// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/tiers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/tiers')>();
  return {
    ...actual,
    getTierRoles: vi.fn(),
  };
});

import { getTierRoles } from '@/lib/auth/tiers';
import { CASE_SUPERVISOR_ROLES } from '@/lib/auth/roles';
import { canUseSupervisorAction } from './require-staff';

const mockedGetTierRoles = vi.mocked(getTierRoles);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('canUseSupervisorAction', () => {
  it('officer + tier default → false (เห็นแบบอ่านอย่างเดียว)', async () => {
    mockedGetTierRoles.mockResolvedValue([...CASE_SUPERVISOR_ROLES]);
    expect(await canUseSupervisorAction('officer')).toBe(false);
  });

  it('chief + tier default → true', async () => {
    mockedGetTierRoles.mockResolvedValue([...CASE_SUPERVISOR_ROLES]);
    expect(await canUseSupervisorAction('chief')).toBe(true);
  });

  it('tier override แคบ + chief → false (อ่านจาก DB)', async () => {
    mockedGetTierRoles.mockResolvedValue(['superadmin']);
    expect(await canUseSupervisorAction('chief')).toBe(false);
  });

  it('getTierRoles throw → fail-closed เหลือ superadmin', async () => {
    mockedGetTierRoles.mockRejectedValue(new Error('db down'));
    expect(await canUseSupervisorAction('chief')).toBe(false);
    expect(await canUseSupervisorAction('superadmin')).toBe(true);
  });
});
