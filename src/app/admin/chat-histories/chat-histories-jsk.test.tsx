// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '@/app/admin/chat/_lib/types';
import { ChatHistoriesClient } from './chat-histories-client';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const fetchConversations = vi.fn();
const fetchConversationPage = vi.fn();
vi.mock('@/app/admin/chat/_lib/api', () => ({
  fetchConversations: (...args: unknown[]) => fetchConversations(...args),
  fetchConversationPage: (...args: unknown[]) => fetchConversationPage(...args),
}));
vi.mock('@/app/admin/chat/_hooks/use-message-search', () => ({
  useMessageSearch: () => ({ results: [], searching: false }),
}));

function conversation(over: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    mode: 'resolved',
    lastMessageText: 'ขอบคุณครับ',
    lastMessageAt: '2026-10-19T10:00:00.000Z',
    lastMessageSender: 'admin',
    unreadAdmin: 0,
    assignedAdminId: null,
    linkedCaseId: null,
    displayName: 'สมชาย',
    pictureUrl: null,
    lineUserId: 'a1b2c3d4',
    ...over,
  };
}

afterEach(() => cleanup());
beforeEach(() => {
  fetchConversations.mockReset();
  fetchConversationPage.mockReset();
});

describe('ChatHistoriesClient ตาราง JSK', () => {
  it('ตาราง ผู้ใช้/ข้อความล่าสุด/เวลา/โหมด + ปุ่มรีเฟรช', async () => {
    const user = userEvent.setup();
    fetchConversations.mockResolvedValue([
      conversation({ mode: 'resolved', displayName: 'Top Pending', lastMessageText: 'ให้บริการปรึกษากฎหมาย' }),
    ]);
    render(<ChatHistoriesClient />);
    const table = await screen.findByRole('table');
    expect(within(table).getByText('ผู้ใช้')).toBeInTheDocument();
    expect(within(table).getByText('ข้อความล่าสุด')).toBeInTheDocument();
    expect(within(table).getByText('เวลา')).toBeInTheDocument();
    expect(within(table).getByText('โหมดแชท')).toBeInTheDocument();
    expect(within(table).getByText('Top Pending')).toBeInTheDocument();
    expect(within(table).getByText('ให้บริการปรึกษากฎหมาย')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'รีเฟรช' })).toBeInTheDocument();
    // § badge โหมดปิดเรื่อง (resolved) คงป้ายไทยเดิม — ไม่ลอก BOT 100% ตามภาพ JSK
    expect(within(table).getByText('ปิดเรื่อง')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'รีเฟรช' }));
    await waitFor(() => expect(fetchConversations).toHaveBeenCalledTimes(2));
  });

  it('pagination 20/หน้า + นับจำนวน', async () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      conversation({ id: `conv-${i}`, displayName: `ผู้ใช้ ${i}` }),
    );
    fetchConversations.mockResolvedValue(rows);
    render(<ChatHistoriesClient />);
    await screen.findByText('ผู้ใช้ 0');
    expect(screen.getByText(/25 สนทนา/)).toBeInTheDocument();
    expect(screen.queryByText('ผู้ใช้ 20')).not.toBeInTheDocument();
  });
});
