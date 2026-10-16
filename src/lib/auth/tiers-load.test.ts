import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * loadTierMap — แยก "ตาราง tier_roles ยังไม่มี" (default ถูกต้องตามนิยาม: ไม่มี override)
 * ออกจาก "อ่านไม่ได้ด้วยเหตุอื่น" (throw ไม่ cache ให้ require-staff fail-closed)
 */

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({ select: () => ({ from: mockFrom }) })),
}));
vi.mock('@/lib/line/config-version', () => ({
  readConfigVersion: vi.fn(async () => null),
  bumpConfigVersion: vi.fn(async () => undefined),
}));

const { getTierRoles, refreshTierCache } = await import('./tiers');
const { ADMIN_ROLES } = await import('./roles');

function pgError(code: string): Error {
  return Object.assign(new Error(`pg ${code}`), { code });
}

beforeEach(() => {
  mockFrom.mockReset();
  refreshTierCache();
});

describe('getTierRoles · ตารางอ่านไม่ได้', () => {
  it('42P01 (ตารางยังไม่มี) → ค่าคงที่ default', async () => {
    mockFrom.mockRejectedValue(pgError('42P01'));
    expect(await getTierRoles('admin')).toEqual([...ADMIN_ROLES]);
  });

  it('42P01 ห่อใน .cause (DrizzleQueryError) → ค่าคงที่ default', async () => {
    mockFrom.mockRejectedValue(Object.assign(new Error('wrapped'), { cause: { code: '42P01' } }));
    expect(await getTierRoles('admin')).toEqual([...ADMIN_ROLES]);
  });

  it('error อื่น (57P01) → reject ไม่ fallback default เงียบ', async () => {
    mockFrom.mockRejectedValue(pgError('57P01'));
    await expect(getTierRoles('admin')).rejects.toThrow('57P01');
  });

  it('ความล้มเหลวไม่ถูก cache — ครั้งถัดไปอ่าน override ได้', async () => {
    mockFrom
      .mockRejectedValueOnce(pgError('57P01'))
      .mockResolvedValueOnce([{ tier: 'admin', roles: ['superadmin'] }]);

    await expect(getTierRoles('admin')).rejects.toThrow();
    expect(await getTierRoles('admin')).toEqual(['superadmin']);
  });
});
