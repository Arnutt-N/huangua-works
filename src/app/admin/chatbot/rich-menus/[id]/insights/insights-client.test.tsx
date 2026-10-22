// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RichMenuItem } from '@/app/admin/_lib/admin-api';
import { RichMenuInsightsClient } from './insights-client';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const listRichMenus = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: { listRichMenus: (...args: unknown[]) => listRichMenus(...args) },
}));

function menu(over: Partial<RichMenuItem> = {}): RichMenuItem {
  return {
    id: 'm1',
    name: 'jsk4.0-v2',
    chatBarText: 'เปิด/ปิด เมนู',
    lineRichMenuId: 'richmenu-abc',
    status: 'active',
    syncStatus: 'synced',
    lastSyncError: null,
    displayStartAt: null,
    displayEndAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

afterEach(() => cleanup());

beforeEach(() => {
  listRichMenus.mockReset();
  listRichMenus.mockResolvedValue({ ok: true, data: { items: [menu()] } });
});

describe('RichMenuInsightsClient', () => {
  it('แสดงชื่อ + สถานะเมนู + โน้ต coming soon + Official Manager', async () => {
    render(<RichMenuInsightsClient menuId="m1" />);
    expect(await screen.findByText('สถานะเมนู: jsk4.0-v2')).toBeInTheDocument();
    expect(screen.getByText('synced')).toBeInTheDocument();
    expect(screen.getByText(/coming soon/)).toBeInTheDocument();
    expect(screen.getByText(/Official Account Manager/)).toBeInTheDocument();
  });

  it('ไม่มีเมนูแสดงข้อความไทย', async () => {
    listRichMenus.mockResolvedValue({ ok: true, data: { items: [] } });
    render(<RichMenuInsightsClient menuId="nope" />);
    expect(await screen.findByText('ไม่พบเมนูนี้')).toBeInTheDocument();
  });
});
