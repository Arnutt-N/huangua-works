// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });

const mocks = vi.hoisted(() => ({
  uploadMedia: vi.fn(),
  deleteMedia: vi.fn(),
}));

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listMedia: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        storageConfigured: true,
        items: [{ id: 'f1', filename: 'a.png', mimeType: 'image/png', sizeBytes: 100, category: 'img', createdAt: '2026-10-01T00:00:00.000Z' }],
      },
    }),
    uploadMedia: mocks.uploadMedia,
    deleteMedia: mocks.deleteMedia,
  },
}));

import { FilesClient } from './files-client';

afterEach(() => cleanup());

beforeEach(() => {
  mocks.uploadMedia.mockReset().mockResolvedValue({ ok: true, data: { ok: true, id: 'x', url: 'u' } });
  mocks.deleteMedia.mockReset().mockResolvedValue({ ok: true, data: { ok: true } });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ url: 'https://signed.example/a.png' }) })));
});

describe('A11Y-02 ปุ่มไฟล์', () => {
  it('ปุ่มเปิด/ลบแสดงตลอด ไม่ซ่อนด้วย opacity-0 ที่ต้อง hover หรือ focus ก่อน', async () => {
    render(<FilesClient />);
    await screen.findByText('a.png');

    for (const label of ['เปิด a.png', 'ลบ a.png']) {
      let node: HTMLElement | null = screen.getByLabelText(label);
      while (node && node !== document.body) {
        expect(node.className).not.toMatch(/(^|\s)opacity-0(\s|$)/);
        node = node.parentElement;
      }
    }
  });
});

describe('FORM-04 ตัวเลือกไฟล์ตรงกับข้อจำกัดเซิร์ฟเวอร์', () => {
  it('input accept เป็นภาพ PNG/JPEG/WebP เท่านั้น ไม่มี PDF หรือ image/* กว้างๆ', async () => {
    render(<FilesClient />);
    await screen.findByText('a.png');
    const input = screen.getByLabelText('อัปโหลดไฟล์สื่อ');
    expect(input).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
    expect(screen.getByText(/รองรับไฟล์ภาพ PNG, JPEG, WebP ขนาดไม่เกิน 10MB/)).toBeInTheDocument();
  });

  it('ไฟล์ PDF → แจ้งข้อผิดพลาดทันที ไม่ยิง API', async () => {
    render(<FilesClient />);
    await screen.findByText('a.png');
    const input = screen.getByLabelText('อัปโหลดไฟล์สื่อ');
    fireEvent.change(input, { target: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] } });

    expect(await screen.findByText('รองรับเฉพาะไฟล์ภาพ PNG, JPEG, WebP')).toBeInTheDocument();
    expect(mocks.uploadMedia).not.toHaveBeenCalled();
  });

  it('ไฟล์ GIF → ถูกปฏิเสธ ไม่ยิง API', async () => {
    render(<FilesClient />);
    await screen.findByText('a.png');
    const input = screen.getByLabelText('อัปโหลดไฟล์สื่อ');
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] } });

    expect(await screen.findByText('รองรับเฉพาะไฟล์ภาพ PNG, JPEG, WebP')).toBeInTheDocument();
    expect(mocks.uploadMedia).not.toHaveBeenCalled();
  });

  it('ไฟล์ภาพเกิน 10MB → ถูกปฏิเสธก่อนส่ง', async () => {
    render(<FilesClient />);
    await screen.findByText('a.png');
    const input = screen.getByLabelText('อัปโหลดไฟล์สื่อ');
    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [big] } });

    expect(await screen.findByText('ไฟล์ใหญ่เกิน 10MB')).toBeInTheDocument();
    expect(mocks.uploadMedia).not.toHaveBeenCalled();
  });

  it('ไฟล์ PNG ปกติ → อัปโหลด', async () => {
    render(<FilesClient />);
    await screen.findByText('a.png');
    const input = screen.getByLabelText('อัปโหลดไฟล์สื่อ');
    fireEvent.change(input, { target: { files: [new File(['x'], 'ok.png', { type: 'image/png' })] } });

    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalledTimes(1));
  });
});

describe('FORM-06 ลบไฟล์ผ่านกล่องยืนยันมาตรฐาน', () => {
  it('กดลบ → เปิดกล่องยืนยัน ยังไม่ลบ, ไม่เรียก window.confirm', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm');
    render(<FilesClient />);
    await screen.findByText('a.png');
    fireEvent.click(screen.getByLabelText('ลบ a.png'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(mocks.deleteMedia).not.toHaveBeenCalled();
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it('กดยืนยัน → ลบจริง', async () => {
    render(<FilesClient />);
    await screen.findByText('a.png');
    fireEvent.click(screen.getByLabelText('ลบ a.png'));
    fireEvent.click(await screen.findByRole('button', { name: 'ลบไฟล์' }));

    await waitFor(() => expect(mocks.deleteMedia).toHaveBeenCalledWith('f1'));
  });

  it('กดยกเลิก → ไม่ลบ', async () => {
    render(<FilesClient />);
    await screen.findByText('a.png');
    fireEvent.click(screen.getByLabelText('ลบ a.png'));
    fireEvent.click(await screen.findByRole('button', { name: 'ยกเลิก' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.deleteMedia).not.toHaveBeenCalled();
  });
});
