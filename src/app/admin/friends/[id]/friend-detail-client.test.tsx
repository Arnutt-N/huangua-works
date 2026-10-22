// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FriendItem } from '@/app/admin/_lib/admin-api';
import { FriendDetailClient } from './friend-detail-client';

const getFriend = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: { getFriend: (...args: unknown[]) => getFriend(...args) },
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
    lastActiveAt: '2026-10-16T13:57:00Z',
    richMenuId: null,
    richMenuName: null,
    ...over,
  };
}

afterEach(() => cleanup());

beforeEach(() => {
  getFriend.mockReset();
  getFriend.mockResolvedValue({ ok: true, data: friend() });
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
});
