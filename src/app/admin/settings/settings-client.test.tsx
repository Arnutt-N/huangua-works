// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: { getSettings: vi.fn(), saveSettings: vi.fn() },
}));

import { adminApi } from '@/app/admin/_lib/admin-api';
import { SettingsClient } from './settings-client';

afterEach(() => {
  cleanup();
  vi.mocked(adminApi.getSettings).mockReset();
});

describe('SettingsClient initial error', () => {
  it('โหลดครั้งแรก 401 แสดง Unauthorized ไม่ใช่หน้าว่าง', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
      status: 401,
    });
    const { container } = render(<SettingsClient />);
    expect(await screen.findByRole('status')).toHaveTextContent('Unauthorized');
    expect(container.querySelector('form, input, textarea')).toBeNull();
  });
});
