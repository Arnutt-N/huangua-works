// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    getLineQuota: vi.fn(),
    refreshLineQuota: vi.fn(),
    getSystemSettings: vi.fn(),
    saveSystemSettings: vi.fn(),
    listApiConnections: vi.fn(),
    refreshApiConnection: vi.fn(),
  },
}));

import { adminApi } from '@/app/admin/_lib/admin-api';
import { SettingsClient } from './settings-client';

afterEach(() => {
  cleanup();
  vi.mocked(adminApi.getSettings).mockReset();
  vi.mocked(adminApi.saveSettings).mockReset();
  vi.mocked(adminApi.getLineQuota).mockReset();
  vi.mocked(adminApi.refreshLineQuota).mockReset();
  vi.mocked(adminApi.getSystemSettings).mockReset();
  vi.mocked(adminApi.listApiConnections).mockReset();
});

describe('SettingsClient initial error', () => {
  it('โหลดครั้งแรก 401 แสดง Unauthorized ไม่ใช่หน้าว่าง', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
      status: 401, code: 'SESSION_EXPIRED',
    });
    // § ส่วนกลางกับ connections ล้มด้วย หน้าแรกต้องยังไม่มี input ใดโผล่มา
    vi.mocked(adminApi.getSystemSettings).mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
      status: 401, code: 'SESSION_EXPIRED',
    });
    vi.mocked(adminApi.listApiConnections).mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
      status: 401, code: 'SESSION_EXPIRED',
    });
    vi.mocked(adminApi.getLineQuota).mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
      status: 401, code: 'SESSION_EXPIRED',
    });
    const { container } = render(<SettingsClient />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unauthorized');
    expect(container.querySelector('form, input, textarea')).toBeNull();
  });

  it('แสดงโควต้า LINE คงเหลือ กดรีเฟรชได้ และบันทึกสวิตช์แจ้งเตือนทาง LINE ได้', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue({
      ok: true,
      data: {
        welcome_message: 'สวัสดี',
        handoff_keywords: ['เจ้าหน้าที่'],
        business_hours: { start: '08:30', end: '16:30', days: [1, 2, 3, 4, 5] },
        bot_enabled: true,
        line_notify_enabled: true,
        line: { configured: true, maskedToken: '****1234' },
      },
    });
    vi.mocked(adminApi.getSystemSettings).mockResolvedValue({
      ok: true,
      data: { maintenance_mode: false, audit_retention_days: 365, import_default_org: 'huangua' },
    });
    vi.mocked(adminApi.listApiConnections).mockResolvedValue({
      ok: true,
      data: { items: [] },
    });
    vi.mocked(adminApi.getLineQuota).mockResolvedValue({
      ok: true,
      data: { type: 'limited', limit: 500, used: 120, remaining: 380 },
    });
    vi.mocked(adminApi.refreshLineQuota).mockResolvedValue({
      ok: true,
      data: { type: 'limited', limit: 500, used: 130, remaining: 370 },
    });
    vi.mocked(adminApi.saveSettings).mockResolvedValue({ ok: true, data: { ok: true } });

    render(<SettingsClient />);

    expect(await screen.findByText(/โควต้า LINE คงเหลือ 380 \/ 500 ข้อความ/)).toBeInTheDocument();

    const refreshBtn = screen.getByRole('button', { name: 'รีเฟรชโควต้า LINE' });
    fireEvent.click(refreshBtn);
    expect(await screen.findByText(/โควต้า LINE คงเหลือ 370 \/ 500 ข้อความ/)).toBeInTheDocument();
    expect(adminApi.refreshLineQuota).toHaveBeenCalledTimes(1);

    const notifyCheckbox = screen.getByLabelText('แจ้งเตือนทาง LINE') as HTMLInputElement;
    expect(notifyCheckbox.checked).toBe(true);
    fireEvent.click(notifyCheckbox);
    expect(notifyCheckbox.checked).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /บันทึกตั้งค่า$/ }));
    await waitFor(() => {
      expect(adminApi.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ line_notify_enabled: false }),
      );
    });

    vi.mocked(adminApi.refreshLineQuota).mockResolvedValueOnce({
      ok: false,
      error: 'ไม่สามารถดึงข้อมูลโควต้าจาก LINE ได้ชั่วคราว',
      status: 502,
    });
    fireEvent.click(refreshBtn);
    expect(
      await screen.findByText('ไม่สามารถดึงข้อมูลโควต้าจาก LINE ได้ชั่วคราว'),
    ).toBeInTheDocument();
  });
});
