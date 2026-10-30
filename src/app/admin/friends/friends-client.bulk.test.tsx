// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FriendItem } from '@/app/admin/_lib/admin-api';
import { FriendsClient } from './friends-client';

// § test นี้รัน userEvent หลายขั้น (checkbox × 2 + select + confirm) — 5s default ไม่พอ
// ตาม AGENTS.md: timing-sensitive tests ต้องตั้ง timeout ชัดเจน ไม่พึ่ง default
vi.setConfig({ testTimeout: 30_000 });

const listFriends = vi.fn();
const listRichMenus = vi.fn();
const assignUserRichMenu = vi.fn();
const unassignUserRichMenu = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listFriends: (...args: unknown[]) => listFriends(...args),
    listRichMenus: (...args: unknown[]) => listRichMenus(...args),
    assignUserRichMenu: (...args: unknown[]) => assignUserRichMenu(...args),
    unassignUserRichMenu: (...args: unknown[]) => unassignUserRichMenu(...args),
  },
}));

function friend(over: Partial<FriendItem> = {}): FriendItem {
  return {
    id: 'f1',
    maskedId: 'U*...001',
    displayName: 'Admin Somying',
    pictureUrl: null,
    followState: 'following',
    followCount: 1,
    refollowCount: 2,
    lastFollowAt: '2026-04-05T00:00:00Z',
    chatMode: 'bot_active',
    lastActiveAt: '2026-10-16T13:57:00Z',
    richMenuId: null,
    richMenuName: null,
    ...over,
  };
}

const RICH_MENUS = [
  { id: 'm1', name: 'เมนูหลัก', chatBarText: 'เมนู', lineRichMenuId: 'rm-1', status: 'active', syncStatus: 'synced', lastSyncError: null, displayStartAt: null, displayEndAt: null, createdAt: '2026-01-01T00:00:00Z' },
];

afterEach(() => cleanup());

beforeEach(() => {
  listFriends.mockReset();
  listRichMenus.mockReset();
  assignUserRichMenu.mockReset();
  unassignUserRichMenu.mockReset();
  listFriends.mockResolvedValue({ ok: true, data: { items: [friend(), friend({ id: 'f2', maskedId: 'U*...002', displayName: 'Jariya' })], total: 2, page: 1, pageSize: 20 } });
  listRichMenus.mockResolvedValue({ ok: true, data: { items: RICH_MENUS } });
  assignUserRichMenu.mockResolvedValue({ ok: true, data: { ok: true } });
  unassignUserRichMenu.mockResolvedValue({ ok: true, data: { ok: true } });
});

describe('FriendsClient bulk JSK', () => {
  it('ตารางมี checkbox + หัวคอลัมน์ User/Rich Menu/Status/Chat Mode/Since/Last Active + refollow badge', async () => {
    render(<FriendsClient />);
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('checkbox').length).toBeGreaterThanOrEqual(2);
    expect(within(table).getAllByText('กลับมา 2 ครั้ง').length).toBe(2);
    for (const head of ['User', 'Status', 'Chat Mode', 'Since', 'Last Active']) {
      expect(within(table).getByText(head)).toBeInTheDocument();
    }
    expect(within(table).getAllByText('BOT').length).toBe(2);
    expect(within(table).getAllByText('ACTIVE').length).toBe(2);
    expect(within(table).getAllByText('5 เม.ย. 2569').length).toBe(2);
  });

  it('เลือก 2 คน + bulk assign ยิงครบทุกราย', async () => {
    const user = userEvent.setup();
    const nativeConfirm = vi.spyOn(window, 'confirm');
    render(<FriendsClient />);
    await screen.findByText('Admin Somying');

    const boxes = within(screen.getByRole('table')).getAllByRole('checkbox');
    await user.click(boxes[1]!);
    await user.click(boxes[2]!);
    await user.click(screen.getByRole('button', { name: 'กำหนด Rich Menu' }));
    expect(await screen.findByText('กำหนดริชเมนู 2 คน')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('เลือก Rich Menu (bulk)'), 'm1');
    await user.click(screen.getByRole('button', { name: 'ยืนยันกำหนด' }));

    expect(await screen.findByText('กำหนดริชเมนูเป็นกลุ่ม')).toBeInTheDocument();
    // คลิกปุ่ม "ยืนยันกำหนด" ใน dialog ของ useConfirm
    const confirmButtons = screen.getAllByRole('button', { name: 'ยืนยันกำหนด' });
    await user.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => expect(assignUserRichMenu).toHaveBeenCalledTimes(2));
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
  });

  it('unsynced menu เลือกไม่ได้', async () => {
    listRichMenus.mockResolvedValue({
      ok: true,
      data: { items: [{ ...RICH_MENUS[0]!, lineRichMenuId: null, syncStatus: 'local' }] },
    });
    const user = userEvent.setup();
    render(<FriendsClient />);
    await screen.findByText('Admin Somying');

    const boxes = within(screen.getByRole('table')).getAllByRole('checkbox');
    await user.click(boxes[1]!);
    await user.click(screen.getByRole('button', { name: 'กำหนด Rich Menu' }));
    expect(await screen.findByText('กำหนดริชเมนู 1 คน')).toBeInTheDocument();

    const select = screen.getByLabelText('เลือก Rich Menu (bulk)');
    expect(within(select as HTMLElement).getByText(/ใช้ไม่ได้/)).toBeInTheDocument();
  });
});
