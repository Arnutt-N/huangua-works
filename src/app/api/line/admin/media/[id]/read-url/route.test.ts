import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * § route นี้ออก presigned URL ให้ client — ต้องรับ id เท่านั้น ห้ามรับ key จาก client
 * (client ที่ล็อกอินได้จะขอ signed URL ของ key อะไรก็ได้ถ้าเปิดช่อง) และต้องไม่คืน
 * URL ของ storage ที่ไม่เซ็นใน response ใด ๆ
 */

const mocks = vi.hoisted(() => ({
  row: null as { id: string; storageKey: string | null; url: string; mimeType: string; filename: string } | null,
  signedKeys: [] as string[],
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
    readUrlForKey: vi.fn(async (key: string) => {
      mocks.signedKeys.push(key);
      return `https://signed.example/${key}?X-Amz-Signature=abc`;
    }),
  };
});

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.limit = async () => (mocks.row ? [mocks.row] : []);
    return { select: () => chain };
  }),
}));

const { GET } = await import('./route');

const ENDPOINT = 'https://abc.supabase.co/storage/v1/s3';

function call(request: Request, id = 'm1') {
  return GET(request, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.row = null;
  mocks.signedKeys.length = 0;
  vi.stubEnv('S3_ENDPOINT', ENDPOINT);
  vi.stubEnv('S3_BUCKET', 'media');
});

describe('GET /api/line/admin/media/[id]/read-url', () => {
  it('เซ็น key จากแถวใน DB ไม่ใช่จาก query string', async () => {
    mocks.row = {
      id: 'm1',
      storageKey: 'general/x.jpg',
      url: `${ENDPOINT}/media/general/x.jpg`,
      mimeType: 'image/jpeg',
      filename: 'x.jpg',
    };

    const res = await call(new Request('http://localhost/api/line/admin/media/m1/read-url?key=evil/secret.jpg'));

    expect(res.status).toBe(200);
    // query string ต้องไม่ถูกใช้ — key ที่เซ็นคือของแถว
    expect(mocks.signedKeys).toEqual(['general/x.jpg']);
  });

  it('fallback ไป url เดิมเมื่อ storageKey ยังว่าง (แถวก่อน backfill)', async () => {
    mocks.row = {
      id: 'm1',
      storageKey: null,
      url: `${ENDPOINT}/media/legacy/y.jpg`,
      mimeType: 'image/png',
      filename: 'y.png',
    };

    const res = await call(new Request('http://localhost/api/line/admin/media/m1/read-url'));

    expect(res.status).toBe(200);
    expect(mocks.signedKeys).toEqual(['legacy/y.jpg']);
  });

  it('คืน 409 เมื่อได้ key ไม่ได้ทั้งสองทาง', async () => {
    mocks.row = {
      id: 'm1',
      storageKey: null,
      url: 'https://foreign.example/z.jpg',
      mimeType: 'image/jpeg',
      filename: 'z.jpg',
    };

    const res = await call(new Request('http://localhost/api/line/admin/media/m1/read-url'));

    expect(res.status).toBe(409);
    expect(mocks.signedKeys).toEqual([]);
  });

  it('คืน 404 เมื่อไม่พบแถว', async () => {
    const res = await call(new Request('http://localhost/api/line/admin/media/nope/read-url'));
    expect(res.status).toBe(404);
    expect(mocks.signedKeys).toEqual([]);
  });

  it('ไม่คืน key หรือ URL ของ storage ใน response', async () => {
    mocks.row = {
      id: 'm1',
      storageKey: 'general/x.jpg',
      url: `${ENDPOINT}/media/general/x.jpg`,
      mimeType: 'image/jpeg',
      filename: 'x.jpg',
    };

    const res = await call(new Request('http://localhost/api/line/admin/media/m1/read-url'));
    const body = JSON.stringify(await res.json());

    expect(body).not.toContain(ENDPOINT);
    expect(body).not.toContain('"storageKey"');
    expect(body).toContain('X-Amz-Signature');
  });

  it('ส่ง contentType และ disposition inline ให้รูป', async () => {
    mocks.row = {
      id: 'm1',
      storageKey: 'general/x.jpg',
      url: `${ENDPOINT}/media/general/x.jpg`,
      mimeType: 'image/jpeg',
      filename: 'x.jpg',
    };

    const { readUrlForKey } = await import('@/lib/storage');
    await call(new Request('http://localhost/api/line/admin/media/m1/read-url'));

    expect(readUrlForKey).toHaveBeenCalledWith(
      'general/x.jpg',
      expect.objectContaining({ contentType: 'image/jpeg', disposition: 'inline', filename: 'x.jpg' }),
    );
  });

  it('ไฟล์ที่ไม่ใช่รูปได้ disposition attachment', async () => {
    mocks.row = {
      id: 'm1',
      storageKey: 'general/doc.pdf',
      url: `${ENDPOINT}/media/general/doc.pdf`,
      mimeType: 'application/pdf',
      filename: 'doc.pdf',
    };

    const { readUrlForKey } = await import('@/lib/storage');
    await call(new Request('http://localhost/api/line/admin/media/m1/read-url'));

    expect(readUrlForKey).toHaveBeenCalledWith(
      'general/doc.pdf',
      expect.objectContaining({ disposition: 'attachment' }),
    );
  });
});
