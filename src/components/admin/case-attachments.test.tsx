// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CaseAttachments, type CaseAttachmentItem } from './case-attachments';

afterEach(() => {
  cleanup();
});

const MOCK_ATTACHMENTS: CaseAttachmentItem[] = [
  {
    key: 'cases/attachments/photo1.jpg',
    url: 'https://storage.huangua.go.th/media/cases/attachments/photo1.jpg',
    type: 'image/jpeg',
    size: 2097152, // 2.00 MB
    name: 'photo1.jpg',
  },
  {
    key: 'cases/attachments/photo2.png',
    url: 'https://storage.huangua.go.th/media/cases/attachments/photo2.png',
    type: 'image/png',
    size: 512000, // 500 KB
    name: 'photo2.png',
  },
];

describe('CaseAttachments Component', () => {
  it('คืนค่า null เมื่อไม่มีไฟล์แนบ (attachments เป็นอาร์เรย์ว่าง)', () => {
    const { container } = render(<CaseAttachments attachments={[]} storageConfigured={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('แสดงกล่องแจ้งเตือนเมื่อ Object Storage ยังไม่เปิดใช้งาน (storageConfigured = false)', () => {
    render(<CaseAttachments attachments={MOCK_ATTACHMENTS} storageConfigured={false} />);

    expect(screen.getByText('ไม่สามารถแสดงภาพถ่ายหลักฐานได้')).toBeInTheDocument();
    expect(screen.getByText(/มีไฟล์แนบ 2 รายการ แต่ระบบจัดเก็บไฟล์/)).toBeInTheDocument();
  });

  it('แสดงตารางภาพตัวอย่าง (Thumbnails) พร้อมชื่อและขนาดไฟล์อย่างถูกต้อง', () => {
    render(<CaseAttachments attachments={MOCK_ATTACHMENTS} storageConfigured={true} />);

    expect(screen.getByText('ภาพถ่ายหรือเอกสารประกอบ (2 รูป)')).toBeInTheDocument();

    const img1 = screen.getByAltText('photo1.jpg');
    expect(img1).toHaveAttribute('src', MOCK_ATTACHMENTS[0]!.url);
    expect(screen.getByText('2.00 MB')).toBeInTheDocument();

    const img2 = screen.getByAltText('photo2.png');
    expect(img2).toHaveAttribute('src', MOCK_ATTACHMENTS[1]!.url);
    expect(screen.getByText('500 KB')).toBeInTheDocument();
  });

  it('แสดง fallback เมื่อไฟล์แนบมี url เป็น null (เซ็น URL ไม่สำเร็จ)', () => {
    const attachmentsWithNull: CaseAttachmentItem[] = [
      {
        key: 'cases/attachments/broken.jpg',
        url: null,
        type: 'image/jpeg',
        size: 1024,
        name: 'broken.jpg',
      },
    ];

    render(<CaseAttachments attachments={attachmentsWithNull} storageConfigured={true} />);

    expect(screen.getByText('broken.jpg')).toBeInTheDocument();
    expect(screen.getByText('ไม่สามารถโหลดภาพได้')).toBeInTheDocument();
  });

  it('คลิกที่รูปภาพแล้วเปิด Dialog Modal ขยายภาพ พร้อมปุ่มเปิดในแท็บใหม่', async () => {
    render(<CaseAttachments attachments={MOCK_ATTACHMENTS} storageConfigured={true} />);

    const button = screen.getByRole('button', { name: 'ดูภาพขนาดใหญ่ photo1.jpg' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const link = screen.getByRole('link', { name: /เปิดภาพขนาดเต็มในแท็บใหม่/ });
    expect(link).toHaveAttribute('href', MOCK_ATTACHMENTS[0]!.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('ปิด Dialog ได้เมื่อกดปุ่มปิด', async () => {
    render(<CaseAttachments attachments={MOCK_ATTACHMENTS} storageConfigured={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'ดูภาพขนาดใหญ่ photo1.jpg' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: 'ปิด' });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
