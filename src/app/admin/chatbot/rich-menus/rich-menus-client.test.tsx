// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RichMenuItem } from '@/app/admin/_lib/admin-api';
import { RichMenusClient } from './rich-menus-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const listRichMenus = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listRichMenus: (...args: unknown[]) => listRichMenus(...args),
    createRichMenu: vi.fn(),
    syncRichMenu: vi.fn(),
    publishRichMenu: vi.fn(),
    uploadRichMenuImage: vi.fn(),
    listMenuAliases: vi.fn().mockResolvedValue({ ok: true, data: { items: [] } }),
    createMenuAlias: vi.fn(),
    repointMenuAlias: vi.fn(),
    deleteMenuAlias: vi.fn(),
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
  listRichMenus.mockResolvedValue({ ok: true, data: { items: [menu()] } });
});

describe('RichMenusClient ตาราง JSK', () => {
  it('หัวตาราง Preview/รายละเอียด/สถานะ/จัดการ + badge Live Now', async () => {
    render(<RichMenusClient />);
    expect(await screen.findByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('รายละเอียดเมนู')).toBeInTheDocument();
    expect(screen.getByText('สถานะ')).toBeInTheDocument();
    expect(screen.getByText('จัดการ')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByText('jsk4.0-v2').length).toBeGreaterThanOrEqual(1);
    // § Bar Text แตกเป็นหลาย text node — matcher รวม textContent เฉพาะ <p>
    expect(
      within(table).getByText(
        (_, el) => el?.tagName === 'P' && (el?.textContent?.includes('เปิด/ปิด เมนู') ?? false),
      ),
    ).toBeInTheDocument();
    expect(within(table).getAllByText('Live Now').length).toBeGreaterThanOrEqual(1);
  });

  it('แถวยังไม่ sync แสดงปุ่ม Sync', async () => {
    listRichMenus.mockResolvedValue({ ok: true, data: { items: [menu({ lineRichMenuId: null, syncStatus: 'local' })] } });
    render(<RichMenusClient />);
    expect(await screen.findByRole('button', { name: /sync/i })).toBeInTheDocument();
  });

  it('ลิงก์ไป Aliases + New Menu + Edit + Insights', async () => {
    render(<RichMenusClient />);
    await screen.findAllByText('jsk4.0-v2');
    expect(screen.getByRole('link', { name: 'Aliases' })).toHaveAttribute('href', '/admin/chatbot/rich-menus/aliases');
    expect(screen.getByRole('link', { name: /สร้าง/ })).toHaveAttribute('href', '/admin/chatbot/rich-menus/new');
    expect(screen.getByRole('link', { name: 'ซิงก์/เผยแพร่ jsk4.0-v2' })).toHaveAttribute(
      'href',
      '/admin/chatbot/rich-menus/m1/edit',
    );
    expect(screen.getByRole('link', { name: 'สถานะเมนู jsk4.0-v2' })).toHaveAttribute(
      'href',
      '/admin/chatbot/rich-menus/m1/insights',
    );
  });
});
