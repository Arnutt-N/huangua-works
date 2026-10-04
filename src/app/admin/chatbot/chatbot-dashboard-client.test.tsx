// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: { getChatbotStats: vi.fn() },
}));

import { adminApi } from '@/app/admin/_lib/admin-api';
import { ChatbotDashboardClient } from './chatbot-dashboard-client';

afterEach(() => {
  cleanup();
  vi.mocked(adminApi.getChatbotStats).mockReset();
});

describe('ChatbotDashboardClient error', () => {
  it('403 แสดง Forbidden ไม่ใช่ข้อความทั่วไปอย่างเดียว', async () => {
    vi.mocked(adminApi.getChatbotStats).mockResolvedValue({
      ok: false,
      error: 'Forbidden',
      status: 403,
    });
    render(<ChatbotDashboardClient />);
    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(screen.queryByText('โหลดข้อมูลไม่สำเร็จ')).not.toBeInTheDocument();
  });
});
