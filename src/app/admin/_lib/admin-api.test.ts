import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from './admin-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('adminApi — error envelope ถูก parse ที่เดียว', () => {
  it('200 + { items, total } → ok:true พร้อม query string ของคำค้น', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [{ id: 'f1' }], total: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await adminApi.listFaq('เปิด');

    expect(res).toEqual({ ok: true, data: { items: [{ id: 'f1' }], total: 1 } });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/line/admin/faq?');
    expect(url).toContain('limit=50');
    expect(url).toContain('q=%E0%B9%80%E0%B8%9B%E0%B8%B4%E0%B8%94');
  });

  it('ดึงข้อความไทยจาก { error } ของ server พร้อม status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'ไม่พบ FAQ' }, 404)));
    const res = await adminApi.deleteFaq('f1');
    expect(res).toEqual({ ok: false, error: 'ไม่พบ FAQ', status: 404 });
  });

  it('ใช้ข้อความ fallback ภาษาไทยเมื่อ response ไม่มี { error }', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    const res = await adminApi.getHealth();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่');
  });

  it('fetch reject → คืน error สายเชื่อมต่อ ไม่ throw ออกจาก adapter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const res = await adminApi.getSettings();
    expect(res).toEqual({ ok: false, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ', status: 0 });
  });

  it('DELETE ไม่แนบ body และไม่ตั้ง Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await adminApi.deleteFaq('f1');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });
});
