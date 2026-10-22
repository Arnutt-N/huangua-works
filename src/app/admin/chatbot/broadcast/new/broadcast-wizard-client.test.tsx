// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BroadcastWizardClient } from './broadcast-wizard-client';

// § เทสนี้รัน userEvent หลายขั้นภายใต้โหลดทั้งชุด timeout 5s ไม่พอ — 30s ตาม intake pattern
vi.setConfig({ testTimeout: 30_000 });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listBroadcastRecipients: vi.fn().mockResolvedValue({ ok: true, data: { items: [] } }),
    dryRunBroadcast: vi.fn(),
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

  it('ขั้นตรวจสอบแสดง preview + dry-run ก่อนสร้าง', async () => {
    const user = userEvent.setup();
    const dryRun = adminApi.dryRunBroadcast as ReturnType<typeof vi.fn>;
    // § ตั้งก่อน render — mock ต้องพร้อมก่อนกดทดลองส่ง
    dryRun.mockResolvedValue({ ok: true, data: { estimatedRecipients: 5 } });
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.type(screen.getByLabelText('ข้อความประกาศ'), 'น้ำประปาไม่ไหล');
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));

    expect(await screen.findByText('น้ำประปาไม่ไหล')).toBeInTheDocument();
    expect(screen.queryByText('ไม่มีสร้างงานจริง')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ประเมินจำนวนผู้รับ' }));
    await waitFor(() => expect(dryRun).toHaveBeenCalledTimes(1));
    // § "ประมาณ {n} คน — ..." แตกเป็นหลาย text node — matcher รวม textContent เฉพาะ span ผล dry-run
    expect(
      await screen.findByText(
        (_, el) => el?.tagName === 'SPAN' && (el?.textContent?.includes('ไม่มีสร้างงานจริง') ?? false),
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
  });

  it('บล็อกเมื่อข้อความว่าง — หยุดตั้งแต่หน้าเขียน', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));

    // § guard goStep ตรวจ buildContent ก่อนออก step 1 — ไม่หลุดไป step สุดท้าย
    expect(await screen.findByText('กรุณากรอกข้อความ')).toBeInTheDocument();
    expect(screen.getByLabelText('ข้อความประกาศ')).toBeInTheDocument();
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

  it('flex ว่าง altText ถูกบล็อก — หยุดตั้งแต่หน้าเขียน', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /Flex Message/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));

    expect(await screen.findByText('กรุณากรอกข้อความสำรอง (altText)')).toBeInTheDocument();
    expect(screen.getByLabelText('Flex JSON')).toBeInTheDocument();
  });

  it('ข้าม step ไม่ได้เมื่อ content ยังผิด — error ค้างหน้าเดิม', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));

    expect(await screen.findByText('กรุณากรอกข้อความ')).toBeInTheDocument();
    expect(screen.getByLabelText('ข้อความประกาศ')).toBeInTheDocument();
  });

  it('ตั้งเวลาอดีตถูกบล็อก', async () => {
    const user = userEvent.setup();
    const create = adminApi.createBroadcast as ReturnType<typeof vi.fn>;
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.type(screen.getByLabelText('ข้อความประกาศ'), 'สวัสดี');
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByLabelText('ตั้งเวลาส่ง (เว้นว่าง = สร้างเป็นร่าง)'));
    await user.type(
      screen.getByLabelText('ตั้งเวลาส่ง (เว้นว่าง = สร้างเป็นร่าง)'),
      '2020-01-01T10:00',
    );
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ตั้งเวลาส่ง/ }));

    expect(await screen.findByText(/เวลาส่งต้องเป็นอนาคต/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
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
      '2099-10-22T10:00',
    );
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ตั้งเวลาส่ง/ }));

    const create = adminApi.createBroadcast as ReturnType<typeof vi.fn>;
    const payload = create.mock.calls[0]?.[0] as { scheduledAt: string | null };
    expect(payload.scheduledAt).toMatch(/Z|[+-]\d{2}:\d{2}$/);
  });
});
