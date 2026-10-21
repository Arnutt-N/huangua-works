// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BroadcastWizardClient } from './broadcast-wizard-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listBroadcastRecipients: vi.fn().mockResolvedValue({ ok: true, data: { items: [] } }),
    dryRunBroadcast: vi.fn().mockResolvedValue({ ok: true, data: { estimatedRecipients: 5 } }),
    createBroadcast: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  },
}));

import { adminApi } from '@/app/admin/_lib/admin-api';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BroadcastWizardClient ตัวช่วยสร้าง 4 ขั้น', () => {
  it('แสดงขั้นตอนครบ 4 ขั้นตอน', () => {
    render(<BroadcastWizardClient />);

    expect(screen.getByText('เลือกประเภท')).toBeInTheDocument();
    expect(screen.getByText('เขียนข้อความ')).toBeInTheDocument();
    expect(screen.getByText('เลือกกลุ่มเป้าหมาย')).toBeInTheDocument();
    expect(screen.getByText('ตรวจสอบและส่ง')).toBeInTheDocument();
  });

  it('เลือกประเภทแล้วไปขั้นเขียนข้อความ', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /รูปภาพ/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));

    expect(screen.getByLabelText('URL รูปภาพ (https)')).toBeInTheDocument();
  });

  it('ขั้นตรวจสอบแสดงสรุปก่อนสร้าง', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));

    expect(screen.getByText('ผู้ติดตามทุกคน')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'สร้างร่าง' })).toBeInTheDocument();
  });

  it('บล็อกเมื่อข้อความว่าง', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: 'สร้างร่าง' }));

    expect(await screen.findByText('กรุณากรอกข้อความ')).toBeInTheDocument();
  });

  it('image ส่ง payload ชนิด image พร้อม URL คู่', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /รูปภาพ/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.type(screen.getByLabelText('URL รูปภาพ (https)'), 'https://example.com/a.jpg');
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: 'สร้างร่าง' }));

    const create = adminApi.createBroadcast as ReturnType<typeof vi.fn>;
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [
          {
            type: 'image',
            originalContentUrl: 'https://example.com/a.jpg',
            previewImageUrl: 'https://example.com/a.jpg',
          },
        ],
      }),
    );
  });

  it('flex ว่าง altText ถูกบล็อก', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /Flex Message/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: 'สร้างร่าง' }));

    expect(await screen.findByText('กรุณากรอกข้อความสำรอง (altText)')).toBeInTheDocument();
  });

  it('schedule แปลงเป็น ISO มี offset', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.type(screen.getByLabelText('ข้อความประกาศ'), 'สวัสดี');
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByLabelText('ตั้งเวลาส่ง (เว้นว่าง = สร้างเป็นร่าง)'));
    await user.type(
      screen.getByLabelText('ตั้งเวลาส่ง (เว้นว่าง = สร้างเป็นร่าง)'),
      '2026-10-22T10:00',
    );
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ตั้งเวลาส่ง/ }));

    const create = adminApi.createBroadcast as ReturnType<typeof vi.fn>;
    const payload = create.mock.calls[0]?.[0] as { scheduledAt: string | null };
    expect(payload.scheduledAt).toMatch(/Z|[+-]\d{2}:\d{2}$/);
  });
});
