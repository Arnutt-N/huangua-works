// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

afterEach(() => {
  cleanup();
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
});
