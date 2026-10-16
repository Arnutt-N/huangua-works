import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * requireStaffApi — ตัดสินสิทธิ์จาก DB สด + tier matrix
 * ล็อก fail-closed: tier matrix อ่านไม่ได้ = เหลือ superadmin (ไม่ใช่ compiled default ที่กว้างกว่า override)
 */

const { mockAuth, mockGetTierRoles, mockLogAudit, mockState } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetTierRoles: vi.fn(),
  mockLogAudit: vi.fn(async () => undefined),
  mockState: { rows: [] as Array<Record<string, unknown>> },
}));

vi.mock('@/auth', () => ({ auth: mockAuth, signOut: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': 'vitest' }) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => mockState.rows }),
      }),
    }),
  })),
}));
vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return { ...actual, logAudit: mockLogAudit };
});
vi.mock('@/lib/auth/tiers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/tiers')>();
  return { ...actual, getTierRoles: mockGetTierRoles };
});

const { requireStaffApi } = await import('./require-staff');
const { STAFF_ROLES } = await import('./roles');

function staff(over: Record<string, unknown> = {}) {
  return { id: 'u1', role: 'officer', isActive: true, passwordVersion: 1, ...over };
}

function lastAuditReason(): unknown {
  const call = mockLogAudit.mock.calls.at(-1) as unknown as [{ metadata: { reason: unknown } }] | undefined;
  return call?.[0].metadata.reason;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { userId: 'u1', passwordVersion: 1 } });
  mockState.rows = [staff()];
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('requireStaffApi · tier matrix อ่านไม่ได้ = fail-closed', () => {
  it('officer + STAFF_ROLES → 403 insufficient_role', async () => {
    mockGetTierRoles.mockRejectedValue(new Error('db down'));

    const result = await requireStaffApi(STAFF_ROLES);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    expect(lastAuditReason()).toBe('insufficient_role');
  });

  it('superadmin ยังผ่าน — อยู่ทุก tier ระบบไม่ล็อกทั้งหมด', async () => {
    mockGetTierRoles.mockRejectedValue(new Error('db down'));
    mockState.rows = [staff({ role: 'superadmin' })];

    expect((await requireStaffApi(STAFF_ROLES)).ok).toBe(true);
  });
});

describe('requireStaffApi · tier matrix อ่านได้', () => {
  it('override แคบ (superadmin อย่างเดียว) ถูกเคารพ → officer 403', async () => {
    mockGetTierRoles.mockResolvedValue(['superadmin']);
    const result = await requireStaffApi(STAFF_ROLES);
    expect(result.ok).toBe(false);
  });

  it('override มี officer → ผ่าน', async () => {
    mockGetTierRoles.mockResolvedValue(['officer', 'superadmin']);
    expect((await requireStaffApi(STAFF_ROLES)).ok).toBe(true);
  });

  it('ไม่ส่ง whitelist → ผ่าน และไม่แตะ tier matrix', async () => {
    expect((await requireStaffApi()).ok).toBe(true);
    expect(mockGetTierRoles).not.toHaveBeenCalled();
  });
});

describe('requireStaffApi · ตัวตน', () => {
  it.each([
    ['inactive', [staff({ isActive: false })]],
    ['citizen_role', [staff({ role: 'citizen' })]],
    ['no_staff_record', []],
  ])('%s → 401 + audit reason', async (reason, rows) => {
    mockState.rows = rows;

    const result = await requireStaffApi(STAFF_ROLES);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    expect(lastAuditReason()).toBe(reason);
  });

  it('passwordVersion ไม่ตรง → 401 stale_credentials', async () => {
    mockState.rows = [staff({ passwordVersion: 2 })];
    const result = await requireStaffApi(STAFF_ROLES);
    expect(result.ok).toBe(false);
    expect(lastAuditReason()).toBe('stale_credentials');
  });
});
