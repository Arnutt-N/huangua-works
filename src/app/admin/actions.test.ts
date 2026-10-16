import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * login action — แยก "รหัสผิด" ออกจาก "รหัสถูกแต่บัญชีไม่มีสิทธิ์"
 * (ข้อความผู้ใช้ + audit ต่างกัน — SIEM นับ brute force จาก LOGIN_FAILURE เท่านั้น)
 */

const { mockSignIn, mockSignOut, mockLogAudit, mockHeaders, mockState } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(async () => undefined),
  mockLogAudit: vi.fn(async () => undefined),
  mockHeaders: vi.fn(async () => new Headers()),
  mockState: { rows: [] as Array<Record<string, unknown>> },
}));

// § next-auth import ใน vitest ไม่ได้ (pnpm layout) — stub เฉพาะ CredentialsSignin ใช้ร่วมทุกโมดูล
vi.mock('next-auth', () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = 'credentials';
  },
}));
vi.mock('@/auth', () => ({ auth: vi.fn(), signIn: mockSignIn, signOut: mockSignOut }));
vi.mock('next/headers', () => ({ headers: mockHeaders }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/auth/require-staff', () => ({ getClientIp: async () => '203.0.113.9' }));
vi.mock('@/lib/rate-limit/enforce', () => ({
  enforceRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, reset: 60 })),
}));
vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return { ...actual, logAudit: mockLogAudit };
});
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => mockState.rows }),
      }),
    }),
  })),
}));

const { login } = await import('./actions');
const { IneligibleAccountSignin } = await import('@/lib/auth/login-errors');
const { CredentialsSignin } = await import('next-auth');
const { AUDIT_ACTIONS } = await import('@/lib/audit');

function form(): FormData {
  const fd = new FormData();
  fd.set('email', 'Staff@Example.test');
  fd.set('password', 'pw');
  return fd;
}

function auditActions(): unknown[] {
  return mockLogAudit.mock.calls.map((c) => (c as unknown as [{ action: unknown }])[0].action);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHeaders.mockImplementation(async () => new Headers());
  mockState.rows = [];
});

describe('login · บัญชีไม่มีสิทธิ์ที่รหัสถูก (authorize throw IneligibleAccountSignin)', () => {
  it('บัญชีระงับ → ข้อความระงับ + ACCESS_DENIED (ไม่ใช่ LOGIN_FAILURE)', async () => {
    mockSignIn.mockRejectedValue(new IneligibleAccountSignin('inactive', 'u1'));

    const result = await login({ error: null }, form());

    expect(result).toEqual({ error: 'บัญชีนี้ถูกระงับการใช้งาน' });
    expect(mockLogAudit).toHaveBeenCalledTimes(1);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.ACCESS_DENIED,
        userId: 'u1',
        metadata: { email: 'staff@example.test', reason: 'inactive' },
      }),
    );
    expect(auditActions()).not.toContain(AUDIT_ACTIONS.LOGIN_FAILURE);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('citizen → ข้อความไม่มีสิทธิ์', async () => {
    mockSignIn.mockRejectedValue(new IneligibleAccountSignin('citizen_role', 'u2'));

    const result = await login({ error: null }, form());

    expect(result).toEqual({ error: 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานส่วนเจ้าหน้าที่' });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.ACCESS_DENIED, metadata: expect.objectContaining({ reason: 'citizen_role' }) }),
    );
  });
});

describe('login · เส้นทางเดิม', () => {
  it('รหัสผิด → ข้อความเดิม + LOGIN_FAILURE invalid_credentials', async () => {
    mockSignIn.mockRejectedValue(new CredentialsSignin());

    const result = await login({ error: null }, form());

    expect(result).toEqual({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        metadata: { email: 'staff@example.test', reason: 'invalid_credentials' },
      }),
    );
  });

  it('error อื่น (config) → re-throw ไม่กลบเป็นรหัสผิด', async () => {
    mockSignIn.mockRejectedValue(new Error('config'));
    await expect(login({ error: null }, form())).rejects.toThrow('config');
  });

  it('สำเร็จ + DB staff active → success + LOGIN_SUCCESS', async () => {
    mockSignIn.mockResolvedValue('http://localhost/admin');
    mockState.rows = [{ id: 'u1', role: 'officer', isActive: true }];

    const result = await login({ error: null }, form());

    expect(result).toEqual({ error: null, success: true });
    expect(auditActions()).toEqual([AUDIT_ACTIONS.LOGIN_SUCCESS]);
  });

  it('race: signIn ผ่านแต่ DB บอกระงับแล้ว → signOut + ข้อความระงับ + ACCESS_DENIED', async () => {
    mockSignIn.mockResolvedValue('http://localhost/admin');
    mockState.rows = [{ id: 'u1', role: 'officer', isActive: false }];

    const result = await login({ error: null }, form());

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ error: 'บัญชีนี้ถูกระงับการใช้งาน' });
    expect(auditActions()).toEqual([AUDIT_ACTIONS.ACCESS_DENIED]);
  });
});

describe('login · X-Auth-Return-Redirect', () => {
  it('มี header → ปฏิเสธก่อน signIn (Auth.js จะไม่ throw และรหัสผิดกลายเป็นสำเร็จ)', async () => {
    mockHeaders.mockImplementation(async () => new Headers({ 'x-auth-return-redirect': '1' }));

    const result = await login({ error: null }, form());

    expect(result).toEqual({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        metadata: { email: 'staff@example.test', reason: 'auth_return_redirect_header' },
      }),
    );
  });
});
