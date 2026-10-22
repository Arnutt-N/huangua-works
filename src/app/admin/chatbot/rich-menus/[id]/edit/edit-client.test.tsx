// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RichMenuItem } from '@/app/admin/_lib/admin-api';
import { RichMenuEditClient } from './edit-client';

const listRichMenus = vi.fn();
const syncRichMenu = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listRichMenus: (...args: unknown[]) => listRichMenus(...args),
    syncRichMenu: (...args: unknown[]) => syncRichMenu(...args),
  },
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
  syncRichMenu.mockReset();
  listRichMenus.mockResolvedValue({ ok: true, data: { items: [menu()] } });
  syncRichMenu.mockResolvedValue({ ok: true, data: { ok: true } });
});

describe('RichMenuEditClient', () => {
  it('แสดงชื่อ + LINE ID + ปุ่มซิงค์ (ไม่แก้ชื่อที่หน้านี้)', async () => {
    render(<RichMenuEditClient menuId="m1" />);
    expect(await screen.findByText(/ซิงก์\/เผยแพร่เมนู/)).toBeInTheDocument();
    expect(screen.getByText('jsk4.0-v2')).toBeInTheDocument();
    expect(screen.getByText('richmenu-abc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ซิงค์ไป LINE' })).toBeInTheDocument();
    expect(screen.getByText(/PATCH server รับแค่ display window/)).toBeInTheDocument();
  });

  it('ไม่มีเมนูแสดงข้อความไทย', async () => {
    listRichMenus.mockResolvedValue({ ok: true, data: { items: [] } });
    render(<RichMenuEditClient menuId="nope" />);
    expect(await screen.findByText('ไม่พบเมนูนี้')).toBeInTheDocument();
  });
});
