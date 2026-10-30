// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

let insertedValues: Record<string, unknown> | null = null;

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn().mockResolvedValue({
    ok: true,
    ctx: { user: { id: 'u1' }, ipAddress: '::1', userAgent: 'test' },
  }),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        insertedValues = val;
        return Promise.resolve(undefined);
      }),
    }),
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

beforeEach(() => {
  insertedValues = null;
});

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
    expect(insertedValues?.status).toBe('scheduled');
    expect(insertedValues?.scheduledAt).toBeInstanceOf(Date);
  });

  it('ไม่ส่ง scheduledAt → 201 (draft)', async () => {
    const res = await POST(req(base));
    expect(res.status).toBe(201);
    expect(insertedValues?.status).toBe('draft');
    expect(insertedValues?.scheduledAt).toBeNull();
  });

  it('FORM-01: ส่ง status="draft" พร้อม scheduledAt → 201 บังคับ scheduledAt เป็น null ป้องกัน cron เผลอยิง', async () => {
    const res = await POST(req({ ...base, status: 'draft', scheduledAt: '2099-01-01T00:00:00.000Z' }));
    expect(res.status).toBe(201);
    expect(insertedValues?.status).toBe('draft');
    expect(insertedValues?.scheduledAt).toBeNull();
  });

  it('FORM-01: ส่ง status="scheduled" โดยไม่มี scheduledAt → 400 ข้อความไทย', async () => {
    const res = await POST(req({ ...base, status: 'scheduled' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/ระบุเวลาส่ง/);
  });
});
