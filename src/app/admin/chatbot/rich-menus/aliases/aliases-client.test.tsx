// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RichMenuItem } from '@/app/admin/_lib/admin-api';
import { RichMenuAliasesClient } from './aliases-client';

const listRichMenus = vi.fn();
const listMenuAliases = vi.fn();
const createMenuAlias = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listRichMenus: (...args: unknown[]) => listRichMenus(...args),
    listMenuAliases: (...args: unknown[]) => listMenuAliases(...args),
    createMenuAlias: (...args: unknown[]) => createMenuAlias(...args),
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
    displayMode: 'ALWAYS',
    syncStatus: 'synced',
    lastSyncError: null,
    imageUrl: null,
    displayStartAt: null,
    displayEndAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

afterEach(() => cleanup());

beforeEach(() => {
  listRichMenus.mockReset();
  listMenuAliases.mockReset();
  createMenuAlias.mockReset();
  listRichMenus.mockResolvedValue({ ok: true, data: { items: [menu()] } });
  listMenuAliases.mockResolvedValue({ ok: true, data: { items: [] } });
  createMenuAlias.mockResolvedValue({ ok: true, data: { ok: true } });
});

describe('RichMenuAliasesClient', () => {
  it('แสดงฟอร์มสร้าง + empty state', async () => {
    render(<RichMenuAliasesClient />);
    expect(await screen.findByText(/ยังไม่มี alias/)).toBeInTheDocument();
    expect(await screen.findByLabelText('Alias ID')).toBeInTheDocument();
    expect(screen.getByLabelText('เมนูเป้าหมาย')).toBeInTheDocument();
  });

  it('alias id ผิดรูปแบบบล็อกก่อนเรียก API', async () => {
    const user = userEvent.setup();
    render(<RichMenuAliasesClient />);
    await screen.findByText(/ยังไม่มี alias/);

    await user.type(screen.getByLabelText('Alias ID'), 'bad alias!');
    await user.click(screen.getByRole('button', { name: 'สร้าง' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'alias id ใช้ได้เฉพาะ a-z A-Z 0-9 _ - ความยาว 1-50 ตัว',
    );
    expect(createMenuAlias).not.toHaveBeenCalled();
  });

  it('ตารางแสดงคอลัมน์สถานะ Sync', async () => {
    listMenuAliases.mockResolvedValue({
      ok: true,
      data: { items: [{ aliasId: 'menu-a', richMenuId: 'm1', menuName: 'jsk4.0-v2', syncStatus: 'synced' }] },
    });
    render(<RichMenuAliasesClient />);
    expect(await screen.findByText('สถานะ Sync')).toBeInTheDocument();
    expect(screen.getByText('SYNCED')).toBeInTheDocument();
  });
});
