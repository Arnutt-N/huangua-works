import { NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(),
}));
vi.mock('@/lib/line/quota', () => ({
  fetchLineQuota: vi.fn(),
}));

import { requireStaffApi } from '@/lib/auth/require-staff';
import { fetchLineQuota } from '@/lib/line/quota';
import { GET } from './route';

describe('GET /api/line/admin/quota', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(requireStaffApi).mockReset();
    vi.mocked(fetchLineQuota).mockReset();
  });

  it('คืน 401/403 เมื่อ requireStaffApi ปฏิเสธสิทธิ์', async () => {
    vi.mocked(requireStaffApi).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET(new Request('http://localhost/api/line/admin/quota'));
    expect(res.status).toBe(401);
  });

  it('คืน 503 เมื่อยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN', async () => {
    vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', '');
    vi.mocked(requireStaffApi).mockResolvedValue({
      ok: true,
      ctx: { user: { id: 'u1', email: 'a@b.c', role: 'superadmin' } as never, ipAddress: '127.0.0.1', userAgent: 'test' },
    });

    const res = await GET(new Request('http://localhost/api/line/admin/quota'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('LINE_CHANNEL_ACCESS_TOKEN');
  });

  it('คืนข้อมูลโควต้าและส่งต่อ forceRefresh เมื่อมี ?refresh=1', async () => {
    vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', 'test-token-1234');
    vi.mocked(requireStaffApi).mockResolvedValue({
      ok: true,
      ctx: { user: { id: 'u1', email: 'a@b.c', role: 'superadmin' } as never, ipAddress: '127.0.0.1', userAgent: 'test' },
    });
    vi.mocked(fetchLineQuota).mockResolvedValue({
      type: 'limited',
      limit: 500,
      used: 120,
      remaining: 380,
    });

    const res = await GET(new Request('http://localhost/api/line/admin/quota?refresh=1'));
    expect(res.status).toBe(200);
    expect(fetchLineQuota).toHaveBeenCalledWith({ forceRefresh: true });
    await expect(res.json()).resolves.toEqual({
      type: 'limited',
      limit: 500,
      used: 120,
      remaining: 380,
    });
  });

  it('คืน 502 พร้อมข้อความภาษาไทยเมื่อดึงโควต้าจาก LINE ล้มเหลว', async () => {
    vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', 'test-token-1234');
    vi.mocked(requireStaffApi).mockResolvedValue({
      ok: true,
      ctx: { user: { id: 'u1', email: 'a@b.c', role: 'superadmin' } as never, ipAddress: '127.0.0.1', userAgent: 'test' },
    });
    vi.mocked(fetchLineQuota).mockRejectedValue(new Error('upstream 500'));

    const res = await GET(new Request('http://localhost/api/line/admin/quota'));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('ไม่สามารถดึงข้อมูลโควต้า');
  });
});
