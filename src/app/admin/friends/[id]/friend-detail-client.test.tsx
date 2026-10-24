// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FriendItem } from '@/app/admin/_lib/admin-api';
import { FriendDetailClient } from './friend-detail-client';

const getFriend = vi.fn();
const listFriendEvents = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    getFriend: (...args: unknown[]) => getFriend(...args),
    listFriendEvents: (...args: unknown[]) => listFriendEvents(...args),
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
    since: '2026-04-05T00:00:00Z',
    chatMode: 'bot_active',
    lastActiveAt: '2026-10-16T13:57:00Z',
    richMenuId: null,
    richMenuName: null,
    ...over,
  };
}

afterEach(() => cleanup());

beforeEach(() => {
  getFriend.mockReset();
  listFriendEvents.mockReset();
  getFriend.mockResolvedValue({ ok: true, data: friend() });
  listFriendEvents.mockResolvedValue({
    ok: true,
    data: {
      items: [
        { id: 'e1', lineUserId: 'f1', event: 'follow', createdAt: '2026-04-05T00:00:00Z', displayName: 'Admin Somying', pictureUrl: null, maskedId: 'U*...001' },
        { id: 'e2', lineUserId: 'f1', event: 'unfollow', createdAt: '2026-05-01T00:00:00Z', displayName: 'Admin Somying', pictureUrl: null, maskedId: 'U*...001' },
        { id: 'e3', lineUserId: 'f1', event: 'follow', createdAt: '2026-05-02T00:00:00Z', displayName: 'Admin Somying', pictureUrl: null, maskedId: 'U*...001' },
      ],
    },
  });
});

describe('FriendDetailClient', () => {
  it('แสดงชื่อ + สถานะ + กลับมา N ครั้ง + ริชเมนู', async () => {
    render(<FriendDetailClient friendId="f1" />);
    expect(await screen.findByText('Admin Somying')).toBeInTheDocument();
    expect(screen.getByText('ติดตามอยู่')).toBeInTheDocument();
    expect(screen.getByText(/กลับมา 2 ครั้ง/)).toBeInTheDocument();
    expect(screen.getByText('เมนูหลัก')).toBeInTheDocument();
    expect(screen.getByText('U*...001')).toBeInTheDocument();
  });

  it('ไม่มีเพื่อนแสดงข้อความไทย', async () => {
    getFriend.mockResolvedValue({ ok: false, error: 'ไม่พบเพื่อนคนนี้', status: 404 });
    render(<FriendDetailClient friendId="nope" />);
    expect(await screen.findByText('ไม่พบเพื่อนคนนี้')).toBeInTheDocument();
  });

  it('timeline แสดงเหตุการณ์ follow/unfollow เรียงใหม่ก่อน ไม่เผย raw id', async () => {
    render(<FriendDetailClient friendId="f1" />);
    await screen.findByText('ประวัติเหตุการณ์');
    const list = screen.getByLabelText('ประวัติเหตุการณ์ของเพื่อน');
    const texts = within(list).getAllByText(/เริ่มติดตาม|ยกเลิกติดตาม/).map((el) => el.textContent);
    // เรียงใหม่ก่อน: e3 (follow 5/2) → e2 (unfollow 5/1) → e1 (follow 4/5)
    expect(texts).toEqual(['เริ่มติดตาม', 'ยกเลิกติดตาม', 'เริ่มติดตาม']);
    expect(screen.getByLabelText('ประวัติเหตุการณ์ของเพื่อน').textContent).not.toContain('U0123456789');
  });
});
