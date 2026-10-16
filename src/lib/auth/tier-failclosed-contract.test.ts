import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVersionedCache } from '@/lib/line/versioned-cache';

/**
 * ผลกระทบ tier นอก diff (PR #118 blast proof) — cache อุ่นคงสิทธิ์เดิมจนครบ TTL
 * และ getTierMatrix ยัง throw เมื่อ SELECT tier_roles ถูกปฏิเสธ (ให้หน้า users
 * รับด้วย getTierMatrixSafe แทน — ดู src/app/admin/actions/tiers.test.ts)
 */

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('PR118 ผลกระทบ tier ที่อยู่นอก diff', () => {
  it('cache ที่อุ่นแล้วคงสิทธิ์เดิมจนครบ TTL เมื่ออ่าน version ไม่ได้', async () => {
    let now = 0;
    const load = vi.fn(async () => ['officer', 'superadmin']);
    const cache = createVersionedCache({
      load,
      readVersion: async () => null,
      ttlMs: 60_000,
      versionCheckMs: 3_000,
      now: () => now,
    });
    expect(await cache.get()).toContain('officer');
    load.mockRejectedValue(Object.assign(new Error('synthetic SELECT denied'), { code: '42501' }));
    now = 59_999;
    expect(await cache.get()).toContain('officer');
    expect(load).toHaveBeenCalledTimes(1);
    now = 60_000;
    await expect(cache.get()).rejects.toMatchObject({ code: '42501' });
  });

  it('getTierMatrix ยัง throw เมื่อ superadmin ผ่าน gate แต่ SELECT tier_roles ถูกปฏิเสธ', async () => {
    vi.resetModules();
    const denied = Object.assign(new Error('synthetic SELECT denied'), { code: '42501' });
    vi.doMock('@/lib/auth/require-staff', () => ({
      requireStaff: vi.fn(async () => ({ user: { id: 'synthetic-superadmin', role: 'superadmin' } })),
    }));
    vi.doMock('@/lib/db', () => ({
      getDb: async () => ({ select: () => ({ from: async () => { throw denied; } }) }),
    }));
    vi.doMock('@/lib/line/config-version', () => ({
      readConfigVersion: async () => null,
      bumpConfigVersion: async () => {},
    }));
    const { getTierMatrix } = await import('@/app/admin/actions/tiers');
    await expect(getTierMatrix()).rejects.toBe(denied);
  }, 30_000);
});
