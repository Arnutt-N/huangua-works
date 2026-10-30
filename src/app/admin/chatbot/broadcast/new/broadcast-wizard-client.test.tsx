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
    createBroadcast: vi.fn().mockResolvedValue({ ok: true, data: { ok: true, id: 'new-1' } }),
    sendBroadcast: vi.fn().mockResolvedValue({ ok: true, data: { ok: true } }),
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

  it('ขั้นเขียนข้อความมีช่องชื่อแคมเปญ + ตัวนับ 5000', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));

    expect(screen.getByLabelText('ชื่อแคมเปญ')).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 5,000/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('ข้อความประกาศ'), 'สวัสดี');
    expect(screen.getByText(/6 \/ 5,000/)).toBeInTheDocument();
  });

  it('ขั้นตรวจสอบแสดง preview + dry-run ก่อนสร้าง', async () => {
    const user = userEvent.setup();
    const dryRun = adminApi.dryRunBroadcast as ReturnType<typeof vi.fn>;
    dryRun.mockResolvedValue({ ok: true, data: { estimatedRecipients: 5 } });
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.type(screen.getByLabelText('ข้อความประกาศ'), 'น้ำประปาไม่ไหล');
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));

    expect(await screen.findByText('น้ำประปาไม่ไหล')).toBeInTheDocument();
    expect(screen.getByText('กลุ่มเป้าหมาย')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ประเมินจำนวนผู้รับ' }));
    await waitFor(() => expect(dryRun).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('ประมาณ 5 คน')).toBeInTheDocument();
  });

  it('บล็อกเมื่อข้อความว่าง — หยุดตั้งแต่หน้าเขียน', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));

    expect(await screen.findByText('กรุณากรอกข้อความ')).toBeInTheDocument();
    expect(screen.getByLabelText('ข้อความประกาศ')).toBeInTheDocument();
  });

  it('วางข้อความเกิน 5000 ตัวอักษรถูกตัดที่ 5000 (maxLength) + ตัวนับเต็ม', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByLabelText('ข้อความประกาศ'));
    // § paste ทาง clipboard เร็วกว่าพิมพ์ 5001 ตัว และ maxLength ตัดให้เหลือ 5000
    await user.paste('ก'.repeat(5001));

    const textarea = screen.getByLabelText('ข้อความประกาศ') as HTMLTextAreaElement;
    expect(textarea.value.length).toBe(5000);
    expect(screen.getByText(/5,000 \/ 5,000/)).toBeInTheDocument();
  });

  it('image ส่ง payload ชนิด image พร้อม URL คู่', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /รูปภาพ/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.type(screen.getByLabelText('URL รูปภาพ (https)'), 'https://example.com/a.jpg');
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: 'บันทึกแบบร่าง' }));

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

  it('ชื่อแคมเปญถูกส่งไปกับ payload', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.type(screen.getByLabelText('ชื่อแคมเปญ'), 'ประกาศปิดทำการ');
    await user.type(screen.getByLabelText('ข้อความประกาศ'), 'ปิดทำการ 12 ส.ค.');
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: 'บันทึกแบบร่าง' }));

    const create = adminApi.createBroadcast as ReturnType<typeof vi.fn>;
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: 'ประกาศปิดทำการ' }));
  });

  it('"ส่งเลย" สร้างแล้วยิง sendBroadcast ต่อทันที', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    const send = adminApi.sendBroadcast as ReturnType<typeof vi.fn>;
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.type(screen.getByLabelText('ข้อความประกาศ'), 'สวัสดี');
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: 'ส่งเลย' }));

    expect(await screen.findByText('ยืนยันการส่งประกาศทันที')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ส่งทันที' }));

    await waitFor(() => expect(send).toHaveBeenCalledWith('new-1'));
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
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

  it('schedule แปลงเป็น ISO มี offset', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.type(screen.getByLabelText('ข้อความประกาศ'), 'สวัสดี');
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));

    await user.click(screen.getByLabelText('วันที่ส่ง (เว้นว่าง = สร้างเป็นร่าง)'));
    await user.click(screen.getByRole('button', { name: 'เดือนถัดไป' }));
    await user.click(screen.getByRole('button', { name: '5' }));
    await user.type(screen.getByLabelText('เวลาส่ง'), '10:00');

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: 'ตั้งเวลาและบันทึก' }));

    const create = adminApi.createBroadcast as ReturnType<typeof vi.fn>;
    const payload = create.mock.calls[0]?.[0] as { scheduledAt: string | null };
    expect(payload.scheduledAt).toMatch(/Z|[+-]\d{2}:\d{2}$/);
  });

  it('draft ส่ง scheduledAt=null แม้ตั้งเวลาไว้', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.type(screen.getByLabelText('ข้อความประกาศ'), 'ร่าง');
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));

    await user.click(screen.getByLabelText('วันที่ส่ง (เว้นว่าง = สร้างเป็นร่าง)'));
    await user.click(screen.getByRole('button', { name: 'เดือนถัดไป' }));
    await user.click(screen.getByRole('button', { name: '5' }));
    await user.type(screen.getByLabelText('เวลาส่ง'), '10:00');

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    // confirm ส่งเลยจะยกเลิกเวลาที่ตั้งไว้ — draft ต้องทิ้งเวลาเช่นกัน
    await user.click(screen.getByRole('button', { name: 'บันทึกแบบร่าง' }));

    const create = adminApi.createBroadcast as ReturnType<typeof vi.fn>;
    const payload = create.mock.calls[0]?.[0] as { scheduledAt: string | null };
    expect(payload.scheduledAt).toBeNull();
    const send = adminApi.sendBroadcast as ReturnType<typeof vi.fn>;
    expect(send).not.toHaveBeenCalled();
  });

  it('send-now ส่ง scheduledAt=null แล้วเรียก /send', async () => {
    const user = userEvent.setup();
    render(<BroadcastWizardClient />);

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.type(screen.getByLabelText('ข้อความประกาศ'), 'ด่วน');
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /ถัดไป/ }));

    await user.click(screen.getByRole('button', { name: 'ส่งเลย' }));
    expect(await screen.findByText('ยืนยันการส่งประกาศทันที')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ส่งทันที' }));

    const create = adminApi.createBroadcast as ReturnType<typeof vi.fn>;
    const payload = create.mock.calls[0]?.[0] as { scheduledAt: string | null };
    expect(payload.scheduledAt).toBeNull();
    const send = adminApi.sendBroadcast as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(send).toHaveBeenCalledWith('new-1'));
  });
});
