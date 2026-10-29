// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });

const mocks = vi.hoisted(() => ({ fetchCalls: [] as string[] }));

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listMedia: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        storageConfigured: true,
        items: [
          { id: 'f1', filename: 'a.png', mimeType: 'image/png', sizeBytes: 100, category: 'img', createdAt: '2026-10-01T00:00:00.000Z' },
          { id: 'f2', filename: 'b.pdf', mimeType: 'application/pdf', sizeBytes: 200, category: 'doc', createdAt: '2026-10-01T00:00:00.000Z' },
        ],
      },
    }),
    deleteMedia: vi.fn(),
    uploadMedia: vi.fn(),
  },
}));

import { FilesClient } from './files-client';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mocks.fetchCalls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      mocks.fetchCalls.push(String(input));
      return { ok: true, json: async () => ({ url: `https://signed.example/${String(input)}` }) };
    }),
  );
});

describe('หน้าไฟล์สื่อ — อ่านผ่าน read-url', () => {
  it('รูปโหลด signed URL จาก read-url ไม่ใช่ url ในรายการ', async () => {
    render(<FilesClient />);
    await screen.findByText('a.png');

    const img = await screen.findByAltText('a.png');
    expect(img.getAttribute('src')).toContain('/read-url');
    expect(mocks.fetchCalls).toContain('/api/line/admin/media/f1/read-url');
  });

  it('ไฟล์ที่ไม่ใช่รูปไม่ยิง read-url', async () => {
    render(<FilesClient />);
    await screen.findByText('b.pdf');
    await waitFor(() => expect(screen.getByText('b.pdf')).toBeInTheDocument());

    expect(mocks.fetchCalls).not.toContain('/api/line/admin/media/f2/read-url');
  });

  it('ไม่มีปุ่มคัดลอก URL แล้ว — URL หมดอายุ 5 นาที', async () => {
    render(<FilesClient />);
    await screen.findByText('a.png');

    expect(screen.queryByLabelText('คัดลอก URL')).not.toBeInTheDocument();
    expect(screen.getByLabelText('เปิด a.png')).toBeInTheDocument();
  });

  it('กดเปิดไฟล์แล้วเปิดแท็บเปล่าก่อน fetch โดยไม่ส่ง noreferrer (ซึ่งจะคืน null) แล้วค่อยเซ็ต location.href', async () => {
    const fakeTab = { opener: window as unknown, location: { href: '' }, close: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockImplementation((_url, _target, features) => {
      // § จำลอง HTML spec จริง: ถ้าส่ง noreferrer/noopener ใน features จะคืน null เสมอ
      if (features?.includes('noreferrer') || features?.includes('noopener')) return null;
      return fakeTab as unknown as Window;
    });

    render(<FilesClient />);
    await screen.findByText('b.pdf');
    fireEvent.click(screen.getByLabelText('เปิด b.pdf'));

    await waitFor(() => {
      expect(fakeTab.location.href).toBe('https://signed.example//api/line/admin/media/f2/read-url');
    });
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(fakeTab.opener).toBeNull();
    openSpy.mockRestore();
  });

  it('ปิดแท็บเปล่าและแจ้งเตือนเมื่อขอ read-url ล้มเหลว', async () => {
    const fakeTab = { opener: window as unknown, location: { href: '' }, close: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeTab as unknown as Window);

    render(<FilesClient />);
    await screen.findByText('b.pdf');

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    fireEvent.click(screen.getByLabelText('เปิด b.pdf'));

    await waitFor(() => {
      expect(fakeTab.close).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByRole('status')).toHaveTextContent('เปิดไฟล์ไม่ได้');
    openSpy.mockRestore();
  });
});
