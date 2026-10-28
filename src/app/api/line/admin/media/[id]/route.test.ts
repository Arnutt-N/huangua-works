import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * § เทสต์นี้พิสูจน์ลำดับของ DELETE: object ต้องถูกลบก่อน row เสมอ
 * (เดิม .catch(() => {}) กลืน error แล้วลบ row ทิ้ง → object กำพร้าที่ไม่มีใครตามลบ)
 */

const mocks = vi.hoisted(() => ({
  row: null as { id: string; url: string } | null,
  deleteFileCalls: [] as string[],
  deleteFileThrows: false,
  rowDeletes: 0,
  audited: [] as unknown[],
}));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: 'admin-1' }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    deleteFile: vi.fn(async (key: string) => {
      mocks.deleteFileCalls.push(key);
      if (mocks.deleteFileThrows) throw new Error('S3 down');
    }),
  };
});

vi.mock('@/lib/audit', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    logAudit: vi.fn(async (entry: unknown) => {
      mocks.audited.push(entry);
    }),
  };
});

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.limit = async () => (mocks.row ? [mocks.row] : []);
    return {
      select: () => chain,
      delete: () => ({
        where: async () => {
          mocks.rowDeletes++;
        },
      }),
    };
  }),
}));

const { DELETE } = await import('./route');

const SUPABASE_ENDPOINT = 'https://abc.supabase.co/storage/v1/s3';

function call() {
  return DELETE(new Request('http://localhost/api/line/admin/media/m1', { method: 'DELETE' }), {
    params: Promise.resolve({ id: 'm1' }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.row = null;
  mocks.deleteFileCalls.length = 0;
  mocks.deleteFileThrows = false;
  mocks.rowDeletes = 0;
  mocks.audited.length = 0;
  vi.stubEnv('S3_ENDPOINT', SUPABASE_ENDPOINT);
  vi.stubEnv('S3_BUCKET', 'media');
});

describe('DELETE /api/line/admin/media/[id]', () => {
  it('ลบ object ด้วย key ที่ถูกต้องแม้ endpoint มี path prefix', async () => {
    mocks.row = { id: 'm1', url: `${SUPABASE_ENDPOINT}/media/general/x.jpg` };

    const res = await call();

    expect(res.status).toBe(200);
    expect(mocks.deleteFileCalls).toEqual(['general/x.jpg']);
    expect(mocks.rowDeletes).toBe(1);
    expect(mocks.audited).toHaveLength(1);
  });

  it('คืน 409 และไม่แตะ DB เมื่อ URL ไม่ตรงรูปแบบ storage', async () => {
    mocks.row = { id: 'm1', url: 'https://other.example/x.jpg' };

    const res = await call();

    expect(res.status).toBe(409);
    expect(mocks.deleteFileCalls).toEqual([]);
    expect(mocks.rowDeletes).toBe(0);
    expect(mocks.audited).toHaveLength(0);
  });

  it('คืน 502 และเก็บ row ไว้เมื่อ S3 ลบไม่สำเร็จ (ไม่ทิ้ง object กำพร้า)', async () => {
    mocks.row = { id: 'm1', url: `${SUPABASE_ENDPOINT}/media/general/x.jpg` };
    mocks.deleteFileThrows = true;

    const res = await call();

    expect(res.status).toBe(502);
    expect(mocks.deleteFileCalls).toEqual(['general/x.jpg']);
    expect(mocks.rowDeletes).toBe(0);
    expect(mocks.audited).toHaveLength(0);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toContain('S3 down');
  });

  it('คืน 404 และไม่เรียก storage เมื่อไม่พบแถว', async () => {
    const res = await call();

    expect(res.status).toBe(404);
    expect(mocks.deleteFileCalls).toEqual([]);
    expect(mocks.rowDeletes).toBe(0);
  });
});
