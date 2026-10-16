import { describe, expect, it, vi } from 'vitest';

/**
 * getTierMatrixSafe — tier_roles ล้มเฉพาะตารางต้องไม่พาหน้า /admin/users ล่มทั้งหน้า
 * (PR #118 finding A: getTierMatrix ยัง throw ตามเดิม ส่วนหน้านี้คืน null ให้ client
 * แสดง tier editor แบบปิดใช้งานแทน)
 */

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn(async () => ({ user: { id: 'synthetic-superadmin', role: 'superadmin' } })),
}));

const { mockGetTierRoles } = vi.hoisted(() => ({ mockGetTierRoles: vi.fn() }));

vi.mock('@/lib/auth/tiers', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/auth/tiers')>();
  return { ...mod, getTierRoles: mockGetTierRoles };
});

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => {
    throw new Error('ต้องไม่แตะ DB ในเทสนี้');
  }),
}));

const { getTierMatrix, getTierMatrixSafe } = await import('./tiers');

describe('getTierMatrixSafe', () => {
  it('อ่านได้ครบคืน matrix เดิม', async () => {
    mockGetTierRoles.mockImplementation(async (key: string) => [`role:${key}`]);
    await expect(getTierMatrixSafe()).resolves.toEqual({
      staff: ['role:staff'],
      case_supervisor: ['role:case_supervisor'],
      admin: ['role:admin'],
      superadmin: ['role:superadmin'],
    });
  });

  it('SELECT tier_roles ถูกปฏิเสธ (42501) คืน null แทน throw', async () => {
    mockGetTierRoles.mockRejectedValue(Object.assign(new Error('permission denied'), { code: '42501' }));
    await expect(getTierMatrixSafe()).resolves.toBeNull();
  });

  it('getTierMatrix ตัวเดิมยัง throw (สัญญาที่ proof ระดับ library พึ่งพา)', async () => {
    const denied = Object.assign(new Error('permission denied'), { code: '42501' });
    mockGetTierRoles.mockRejectedValue(denied);
    await expect(getTierMatrix()).rejects.toBe(denied);
  });
});
