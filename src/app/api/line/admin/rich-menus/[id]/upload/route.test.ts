import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authed: true,
  uploadResult: { ok: true } as { ok: boolean; error?: string },
  audited: [] as unknown[],
}));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () =>
    mocks.authed
      ? {
          ok: true,
          ctx: { user: { id: 'admin-1' }, ipAddress: '127.0.0.1', userAgent: undefined },
        }
      : { ok: false, response: new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }) },
  ),
}));

vi.mock('@/lib/line/rich-menu-service', () => ({
  uploadMenuImage: vi.fn(async () => mocks.uploadResult),
}));

vi.mock('@/lib/audit', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    logAudit: vi.fn(async (entry: unknown) => {
      mocks.audited.push(entry);
    }),
  };
});

import { POST } from './route';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function uploadRequest(file?: File): Request {
  const form = new FormData();
  if (file) form.set('file', file);
  return new Request('http://localhost:3000/api/line/admin/rich-menus/m1/upload', {
    method: 'POST',
    body: form,
  });
}

function pngFile(size = PNG.length): File {
  const buf = Buffer.alloc(size);
  PNG.copy(buf);
  return new File([buf], 'menu.png', { type: 'image/png' });
}

beforeEach(() => {
  mocks.authed = true;
  mocks.uploadResult = { ok: true };
  mocks.audited = [];
});

describe('POST rich-menus/[id]/upload', () => {
  test('ไม่มีสิทธิ์ → 401', async () => {
    mocks.authed = false;
    const res = await POST(uploadRequest(pngFile()), { params: Promise.resolve({ id: 'm1' }) });
    expect(res.status).toBe(401);
  });

  test('ไม่แนบไฟล์ → 400', async () => {
    const res = await POST(uploadRequest(), { params: Promise.resolve({ id: 'm1' }) });
    expect(res.status).toBe(400);
  });

  test('ไฟล์เกิน 1MB → 413 ภาษาไทย', async () => {
    const res = await POST(uploadRequest(pngFile(1024 * 1024 + 1)), {
      params: Promise.resolve({ id: 'm1' }),
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('1 MB');
  });

  test('ไฟล์ปลอม (txt) → 422', async () => {
    const fake = new File(['hello'], 'x.txt', { type: 'text/plain' });
    const res = await POST(uploadRequest(fake), { params: Promise.resolve({ id: 'm1' }) });
    expect(res.status).toBe(422);
  });

  test('JPEG ผ่าน magic sniff → 200 + audit หนึ่งแถว', async () => {
    const file = new File([JPG], 'menu.jpg', { type: 'image/jpeg' });
    const res = await POST(uploadRequest(file), { params: Promise.resolve({ id: 'm1' }) });
    expect(res.status).toBe(200);
    expect(mocks.audited).toHaveLength(1);
  });

  test('service ล้ม (ยังไม่ sync) → 422 พร้อมข้อความเดิม', async () => {
    mocks.uploadResult = { ok: false, error: 'ต้อง sync ก่อนอัปโหลดรูป' };
    const res = await POST(uploadRequest(pngFile()), { params: Promise.resolve({ id: 'm1' }) });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('sync');
    expect(mocks.audited).toHaveLength(0);
  });
});
