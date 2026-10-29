// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

afterEach(cleanup);

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
});
