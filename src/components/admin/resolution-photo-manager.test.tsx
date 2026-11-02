// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResolutionPhotoManager } from './resolution-photo-manager';
import type { ResolutionPhoto } from '@/lib/cases/resolution-photos';
import * as casesActions from '@/app/admin/actions/cases';

vi.mock('@/app/admin/actions/cases', () => ({
  uploadResolutionPhotoAction: vi.fn(async () => ({ error: null, success: 'บันทึกภาพถ่ายเรียบร้อย' })),
  deleteResolutionPhotoAction: vi.fn(async () => ({ error: null, success: 'ลบภาพถ่ายเรียบร้อย' })),
}));

describe('ResolutionPhotoManager Component', () => {
  const mockPhotos: ResolutionPhoto[] = [
    {
      id: 'p-1',
      key: 'cases/resolutions/c-1/p-1.jpg',
      url: 'https://storage.local/cases/resolutions/c-1/p-1.jpg',
      tag: 'before',
      caption: 'ภาพก่อนเริ่มงานซ่อม',
      size: 1024 * 300,
      type: 'image/jpeg',
      uploadedAt: '2026-11-02T10:00:00Z',
      uploadedBy: 'staff-1',
    },
    {
      id: 'p-2',
      key: 'cases/resolutions/c-1/p-2.jpg',
      url: 'https://storage.local/cases/resolutions/c-1/p-2.jpg',
      tag: 'after',
      caption: 'ภาพงานซ่อมแล้วเสร็จ',
      size: 1024 * 400,
      type: 'image/jpeg',
      uploadedAt: '2026-11-02T11:00:00Z',
      uploadedBy: 'staff-1',
    },
  ];

  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('เรนเดอร์ฟอร์มอัปโหลดและรายการภาพถ่าย Before & After ครบถ้วน', () => {
    render(<ResolutionPhotoManager caseId="c-1" photos={mockPhotos} storageConfigured={true} />);

    expect(screen.getByText(/แนบภาพถ่ายผลการดำเนินงาน \(ก่อนทำ \/ หลังทำ\)/i)).toBeInTheDocument();
    expect(screen.getByText(/ก่อนดำเนินการ \(Before\) · 1/i)).toBeInTheDocument();
    expect(screen.getByText(/หลังดำเนินการ \(After\) · 1/i)).toBeInTheDocument();
    expect(screen.getByText('ภาพก่อนเริ่มงานซ่อม')).toBeInTheDocument();
    expect(screen.getByText('ภาพงานซ่อมแล้วเสร็จ')).toBeInTheDocument();
  });

  it('สามารถสลับเลือกแท็ก Before และ After ได้อย่างถูกต้องตามเกณฑ์ a11y', async () => {
    const user = userEvent.setup();
    render(<ResolutionPhotoManager caseId="c-1" photos={mockPhotos} storageConfigured={true} />);

    const beforeRadio = screen.getByRole('radio', { name: /ภาพก่อนดำเนินการ/i });
    const afterRadio = screen.getByRole('radio', { name: /ภาพหลังดำเนินการ/i });

    expect(beforeRadio).toHaveAttribute('aria-checked', 'true');
    expect(afterRadio).toHaveAttribute('aria-checked', 'false');

    await user.click(afterRadio);
    expect(beforeRadio).toHaveAttribute('aria-checked', 'false');
    expect(afterRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('ปุ่มอัปโหลดจะถูก disabled เมื่อยังไม่ได้เลือกไฟล์ภาพถ่าย', () => {
    render(<ResolutionPhotoManager caseId="c-1" photos={mockPhotos} storageConfigured={true} />);

    const uploadBtn = screen.getByRole('button', { name: /อัปโหลดภาพผลงาน/i });
    expect(uploadBtn).toBeDisabled();
  });

  it('เปิดกล่องยืนยันการลบเมื่อกดปุ่มลบภาพถ่าย และเรียก action เมื่อกดยืนยัน', async () => {
    const user = userEvent.setup();
    render(<ResolutionPhotoManager caseId="c-1" photos={mockPhotos} storageConfigured={true} />);

    const deleteBtn = screen.getByRole('button', { name: /ลบภาพถ่าย ภาพก่อนเริ่มงานซ่อม/i });
    await user.click(deleteBtn);

    expect(screen.getByText('ยืนยันการลบภาพถ่ายผลงาน')).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole('button', { name: 'ยืนยันการลบ' });
    await user.click(confirmDeleteBtn);

    expect(casesActions.deleteResolutionPhotoAction).toHaveBeenCalled();
  });
});
