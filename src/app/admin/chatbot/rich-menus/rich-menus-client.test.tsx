// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RichMenuItem } from '@/app/admin/_lib/admin-api';
import { RichMenusClient } from './rich-menus-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const listRichMenus = vi.fn();
const deleteRichMenu = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listRichMenus: (...args: unknown[]) => listRichMenus(...args),
    deleteRichMenu: (...args: unknown[]) => deleteRichMenu(...args),
    syncRichMenu: vi.fn(),
    publishRichMenu: vi.fn(),
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
    userLinkCount: 0,
    ...over,
  };
}

afterEach(() => cleanup());

beforeEach(() => {
  listRichMenus.mockReset();
  deleteRichMenu.mockReset();
  listRichMenus.mockResolvedValue({ ok: true, data: { items: [menu()] } });
  deleteRichMenu.mockResolvedValue({ ok: true, data: { ok: true } });
});

describe('RichMenusClient ตาราง JSK', () => {
  it('หัวตาราง Preview/รายละเอียด/สถานะ/จัดการ + badge ACTIVE', async () => {
    render(<RichMenusClient />);
    expect(await screen.findByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('รายละเอียดเมนู')).toBeInTheDocument();
    expect(screen.getByText('สถานะ')).toBeInTheDocument();
    expect(screen.getByText('จัดการ')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByText('jsk4.0-v2').length).toBeGreaterThanOrEqual(1);
    expect(within(table).getAllByText('ACTIVE').length).toBeGreaterThanOrEqual(1);
  });

  it('แถวยังไม่ sync แสดงปุ่ม Sync to LINE และไม่แสดงปุ่มอัปรูป', async () => {
    listRichMenus.mockResolvedValue({
      ok: true,
      data: { items: [menu({ lineRichMenuId: null, syncStatus: 'pending', status: 'draft' })] },
    });
    render(<RichMenusClient />);
    expect(await screen.findByRole('button', { name: /sync to line/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'อัปรูป jsk4.0-v2' })).not.toBeInTheDocument();
  });

  it('แถวที่ sync แล้วแสดงปุ่มอัปรูปเพื่อให้ส่งรูปขึ้น LINE ก่อนกด Set Active', async () => {
    listRichMenus.mockResolvedValue({
      ok: true,
      data: { items: [menu({ status: 'draft' })] },
    });
    render(<RichMenusClient />);
    expect(await screen.findByRole('button', { name: 'อัปรูป jsk4.0-v2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Active' })).toBeInTheDocument();
  });

  it('แก้ไขแล้วยังไม่ซิงค์แสดงป้าย รอซิงค์ + ปุ่มซิงค์การแก้ไข', async () => {
    listRichMenus.mockResolvedValue({
      ok: true,
      data: { items: [menu({ syncStatus: 'pending' })] },
    });
    render(<RichMenusClient />);
    expect(await screen.findByText('รอซิงค์')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ซิงค์การแก้ไข' })).toBeInTheDocument();
  });

  it('แสดงจำนวนผู้ใช้ที่ผูกเมนู', async () => {
    listRichMenus.mockResolvedValue({
      ok: true,
      data: { items: [menu({ userLinkCount: 12 })] },
    });
    render(<RichMenusClient />);
    expect(await screen.findByText('12 ผู้ใช้')).toBeInTheDocument();
  });

  it('ลิงก์ไป Aliases + New Menu + Edit + Insights', async () => {
    render(<RichMenusClient />);
    await screen.findAllByText('jsk4.0-v2');
    expect(screen.getByRole('link', { name: /Aliases/ })).toHaveAttribute(
      'href',
      '/admin/chatbot/rich-menus/aliases',
    );
    expect(screen.getByRole('link', { name: /New Menu/ })).toHaveAttribute(
      'href',
      '/admin/chatbot/rich-menus/new',
    );
    expect(screen.getByRole('link', { name: 'แก้ไข jsk4.0-v2' })).toHaveAttribute(
      'href',
      '/admin/chatbot/rich-menus/m1/edit',
    );
    expect(screen.getByRole('link', { name: 'สถิติ jsk4.0-v2' })).toHaveAttribute(
      'href',
      '/admin/chatbot/rich-menus/m1/insights',
    );
  });

  it('กดลบต้องยืนยันก่อนจึงเรียก API', async () => {
    const user = userEvent.setup();
    render(<RichMenusClient />);
    await screen.findAllByText('jsk4.0-v2');
    await user.click(screen.getByRole('button', { name: 'ลบ jsk4.0-v2' }));
    expect(await screen.findByText('ยืนยันการลบ')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ลบ' }));
    expect(deleteRichMenu).toHaveBeenCalledWith('m1');
  });
});
