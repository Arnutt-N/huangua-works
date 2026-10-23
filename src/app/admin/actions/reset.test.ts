import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));
vi.mock('@/lib/db/query-helpers', () => ({
  firstOrUndefined: vi.fn(),
}));
vi.mock('@/lib/audit', () => ({
  AUDIT_ACTIONS: {
    PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
    PASSWORD_RESET_FAILURE: 'PASSWORD_RESET_FAILURE',
    PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS',
  },
  logAudit: vi.fn(),
}));
vi.mock('@/lib/auth/require-staff', () => ({
  getClientIp: vi.fn().mockResolvedValue('127.0.0.1'),
  getClientUserAgent: vi.fn().mockResolvedValue('vitest'),
}));
vi.mock('@/lib/rate-limit/enforce', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue({ allowed: true, reset: 0 }),
}));
vi.mock('@/lib/auth/reset-token', () => ({
  createResetToken: vi.fn(),
  validateResetToken: vi.fn(),
  burnResetToken: vi.fn(),
}));
vi.mock('@/lib/mail', () => ({
  isMailDeliverable: vi.fn(),
  sendMail: vi.fn(),
  buildResetEmailHtml: vi.fn().mockReturnValue('<p>reset</p>'),
}));

import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { logAudit } from '@/lib/audit';
import { createResetToken } from '@/lib/auth/reset-token';
import { isMailDeliverable, sendMail } from '@/lib/mail';
import { requestPasswordReset } from './reset';

describe('requestPasswordReset undeliverable guard (JSK PR #284)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function mockEligibleUser() {
    vi.mocked(getDb).mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    } as never);
    vi.mocked(firstOrUndefined).mockResolvedValue({
      id: 'u-staff-1',
      email: 'officer@huangua.go.th',
      fullName: 'เจ้าหน้าที่ ทดสอบ',
      role: 'officer',
      isActive: true,
    } as never);
  }

  it('ไม่สร้าง reset token ใหม่เมื่อระบบส่งอีเมลไม่ได้ (no mint when undeliverable)', async () => {
    mockEligibleUser();
    vi.mocked(isMailDeliverable).mockReturnValue(false);

    const fd = new FormData();
    fd.set('email', 'officer@huangua.go.th');

    const res = await requestPasswordReset({ error: null }, fd);

    expect(res).toEqual({ error: null, success: true });
    expect(createResetToken).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PASSWORD_RESET_FAILURE',
        userId: 'u-staff-1',
        metadata: { reason: 'mail_not_configured' },
      }),
    );
  });

  it('สร้าง reset token และส่งอีเมลตามปกติเมื่อระบบอีเมลพร้อมใช้งาน', async () => {
    mockEligibleUser();
    vi.mocked(isMailDeliverable).mockReturnValue(true);
    vi.mocked(createResetToken).mockResolvedValue('tok-123');
    vi.mocked(sendMail).mockResolvedValue(undefined);

    const fd = new FormData();
    fd.set('email', 'officer@huangua.go.th');

    const res = await requestPasswordReset({ error: null }, fd);

    expect(res).toEqual({ error: null, success: true });
    expect(createResetToken).toHaveBeenCalledWith('u-staff-1');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});
