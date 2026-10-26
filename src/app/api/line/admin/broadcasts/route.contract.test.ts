// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn().mockResolvedValue({
    ok: true,
    ctx: { user: { id: 'u1' }, ipAddress: '::1', userAgent: 'test' },
  }),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  }),
}));

vi.mock('@/lib/audit', () => ({
  AUDIT_ACTIONS: { BROADCAST_CREATE: 'BROADCAST_CREATE' },
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from './route';

function req(body: unknown): Request {
  return new Request('http://localhost/api/line/admin/broadcasts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const base = {
  content: [{ type: 'text', text: 'สวัสดี' }],
  target: { kind: 'all' },
};

describe('POST /api/line/admin/broadcasts contract', () => {
  it('scheduledAt อดีต → 400 ข้อความไทย', async () => {
    const res = await POST(req({ ...base, scheduledAt: '2000-01-01T00:00:00.000Z' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/อนาคต/);
  });

  it('scheduledAt อนาคต → 201', async () => {
    const res = await POST(req({ ...base, scheduledAt: '2099-01-01T00:00:00.000Z' }));
    expect(res.status).toBe(201);
  });

  it('ไม่ส่ง scheduledAt → 201 (draft)', async () => {
    const res = await POST(req(base));
    expect(res.status).toBe(201);
  });
});
