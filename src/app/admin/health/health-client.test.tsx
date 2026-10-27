// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: { getHealth: vi.fn() },
}));

import { adminApi } from '@/app/admin/_lib/admin-api';
import { HealthClient } from './health-client';

afterEach(() => {
  cleanup();
  vi.mocked(adminApi.getHealth).mockReset();
});

describe('HealthClient error', () => {
  it('โหลดครั้งแรก 401 แสดง Unauthorized ไม่ใช่หน้าว่าง', async () => {
    vi.mocked(adminApi.getHealth).mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
      status: 401, code: 'SESSION_EXPIRED',
    });
    render(<HealthClient />);
    // error แสดงทั้ง inline banner และ AdminErrorState card — assert ว่าเห็นอย่างน้อย 1 และไม่ใช่หน้าว่าง
    const matches = await screen.findAllByText('Unauthorized');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('โหลดสถานะไม่สำเร็จ')).not.toBeInTheDocument();
  });

  it('reload ล้ม 403 แสดง Forbidden ขณะการ์ดเดิมยังอยู่', async () => {
    vi.mocked(adminApi.getHealth)
      .mockResolvedValueOnce({
        ok: true,
        data: { status: 'healthy', probes: [], timestamp: '2026-10-03T00:00:00.000Z' },
      })
      .mockResolvedValueOnce({ ok: false, error: 'Forbidden', status: 403, code: 'FORBIDDEN' });
    render(<HealthClient />);
    expect(await screen.findByText('ปกติ')).toBeInTheDocument();
    screen.getByRole('button', { name: /refresh/i }).click();
    await waitFor(() => expect(screen.getByText('Forbidden')).toBeInTheDocument());
    expect(screen.getByText('ปกติ')).toBeInTheDocument();
  });
});
