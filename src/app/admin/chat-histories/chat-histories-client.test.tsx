// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation, Message } from '@/app/admin/chat/_lib/types';
import { ChatHistoriesClient, ChatHistoryDetail } from './chat-histories-client';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const fetchConversations = vi.fn();
const fetchConversationPage = vi.fn();
vi.mock('@/app/admin/chat/_lib/api', () => ({
  fetchConversations: (...args: unknown[]) => fetchConversations(...args),
  fetchConversationPage: (...args: unknown[]) => fetchConversationPage(...args),
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

function message(over: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    sender: 'user',
    messageType: 'text',
    textContent: 'สวัสดีครับ',
    createdAt: '2026-10-19T09:00:00.000Z',
    ...over,
  };
}

const RAW_LINE_ID = 'U0123456789abcdef0123456789abcdef';

function bodyText(): string {
  return document.body.textContent ?? '';
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  fetchConversations.mockReset();
  fetchConversationPage.mockReset();
});

describe('ChatHistoriesClient อ่านอย่างเดียว', () => {
  it('ลิสต์แสดงชื่อ เวลา ข้อความล่าสุด และป้ายสถานะไทย ไม่ใช่ enum ดิบ', async () => {
    fetchConversations.mockResolvedValue([
      conversation({ mode: 'resolved' }),
      conversation({ id: 'conv-2', mode: 'bot_active', displayName: 'สมหญิง' }),
    ]);
    render(<ChatHistoriesClient />);

    expect(await screen.findByText('สมชาย')).toBeInTheDocument();
    expect(screen.getByText('ขอบคุณครับ')).toBeInTheDocument();
    expect(screen.getByText('ปิดแล้ว')).toBeInTheDocument();
    expect(bodyText()).not.toMatch(/\bresolved\b/);
    expect(bodyText()).not.toMatch(/\bbot_active\b/);
  });

  it('ค่าเริ่มต้นเห็นเฉพาะห้องปิดแล้ว สลับไปทั้งหมดเห็นทุกห้อง', async () => {
    const user = userEvent.setup();
    fetchConversations.mockResolvedValue([
      conversation({ mode: 'resolved' }),
      conversation({ id: 'conv-2', mode: 'bot_active', displayName: 'สมหญิง' }),
    ]);
    render(<ChatHistoriesClient />);
    await screen.findByText('สมชาย');

    expect(screen.queryByText('สมหญิง')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ทั้งหมด/ }));
    expect(screen.getByText('สมหญิง')).toBeInTheDocument();
  });

  it('ค้นหากรองลิสต์ฝั่ง client', async () => {
    const user = userEvent.setup();
    fetchConversations.mockResolvedValue([
      conversation({ mode: 'resolved' }),
      conversation({ id: 'conv-2', mode: 'resolved', displayName: 'สมหญิง' }),
    ]);
    render(<ChatHistoriesClient />);
    await screen.findByText('สมชาย');

    await user.type(screen.getByLabelText('ค้นหาประวัติการสนทนา'), 'สมหญิง');
    await waitFor(() => expect(screen.queryByText('สมชาย')).not.toBeInTheDocument());
    expect(screen.getByText('สมหญิง')).toBeInTheDocument();
  });

  it('ไม่มีช่องพิมพ์ ไม่มีปุ่มส่ง ไม่มีปุ่มเปลี่ยนโหมด', async () => {
    fetchConversations.mockResolvedValue([conversation()]);
    render(<ChatHistoriesClient />);
    await screen.findByText('สมชาย');

    expect(screen.queryByLabelText('พิมพ์ข้อความ')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ส่ง/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /บอท|เจ้าหน้าที่|ปิดเรื่อง|โอนแชท/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('แสดงข้อมูลลูกค้า')).not.toBeInTheDocument();
  });

  it('แสดง masked id 8 ตัวอักษร และไม่พบ raw LINE id ใน UI', async () => {
    fetchConversations.mockResolvedValue([
      conversation({ displayName: null, lineUserId: 'a1b2c3d4' }),
    ]);
    render(<ChatHistoriesClient />);
    await screen.findByText('ผู้ใช้ LINE a1b2c3d4');
    expect(screen.getByText('a1b2c3d4')).toBeInTheDocument();
    expect(bodyText()).not.toContain(RAW_LINE_ID);
  });

  it('ห้องว่างแสดง empty state ไทย', async () => {
    fetchConversations.mockResolvedValue([]);
    render(<ChatHistoriesClient />);
    expect(await screen.findByText('ยังไม่มีประวัติการสนทนาที่ปิดแล้ว')).toBeInTheDocument();
  });
});

describe('ChatHistoryDetail อ่านอย่างเดียว', () => {
  function mockDetail(
    conv: {
      id?: string;
      mode?: string;
      displayName?: string | null;
      pictureUrl?: string | null;
      lineUserId?: string | null;
      lastMessageAt?: string | null;
    } = {},
    msgs: Message[] = [message(), message({ id: 'm2', sender: 'admin', textContent: 'รับเรื่องแล้วครับ' })],
  ) {
    fetchConversationPage.mockResolvedValue({
      conversation: {
        id: conv.id ?? 'conv-1',
        mode: conv.mode ?? 'resolved',
        lineUserId: conv.lineUserId ?? 'a1b2c3d4',
        displayName: conv.displayName ?? 'สมชาย',
        pictureUrl: conv.pictureUrl ?? null,
        lastMessageAt: conv.lastMessageAt ?? '2026-10-19T10:00:00.000Z',
        assignedAdminId: null,
        linkedCaseId: null,
        adminNote: null,
        adminNoteUpdatedAt: null,
        adminNoteUpdatedBy: null,
        unreadAdmin: 0,
        createdAt: '2026-10-19T08:00:00.000Z',
      },
      messages: msgs,
      hasMore: false,
    });
    // § ไม่ใช้ลิสต์ทั้งห้องเรนเดอร์ header แถวเดียว — detail payload ต้องมี header ครบ
    fetchConversations.mockResolvedValue(null);
  }

  it('ข้อความเรียงเก่าไปใหม่ ไม่มีช่องส่ง', async () => {
    mockDetail();
    render(<ChatHistoryDetail conversationId="conv-1" />);

    await screen.findByText('รับเรื่องแล้วครับ');
    const list = screen.getByLabelText('ข้อความในการสนทนา');
    const texts = within(list)
      .getAllByText(/สวัสดีครับ|รับเรื่องแล้วครับ/)
      .map((el) => el.textContent);
    expect(texts).toEqual(['สวัสดีครับ', 'รับเรื่องแล้วครับ']);
    expect(screen.queryByLabelText('พิมพ์ข้อความ')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ลองอีกครั้ง/ })).not.toBeInTheDocument();
  });

  it('หัวห้องแสดงชื่อ ป้ายสถานะไทย และ masked id ไม่ใช่ raw id', async () => {
    mockDetail();
    render(<ChatHistoryDetail conversationId="conv-1" />);

    await screen.findByText('รับเรื่องแล้วครับ');
    expect(screen.getAllByText('สมชาย').length).toBeGreaterThan(0);
    expect(screen.getByText('ปิดเรื่อง')).toBeInTheDocument();
    expect(screen.getByText('a1b2c3d4')).toBeInTheDocument();
    expect(fetchConversations).not.toHaveBeenCalled();
    expect(bodyText()).not.toContain(RAW_LINE_ID);
    expect(bodyText()).not.toMatch(/\bresolved\b/);
  });

  it('หัวห้องใช้ displayName/pictureUrl/masked id จาก detail payload', async () => {
    mockDetail({
      displayName: 'สมหญิง',
      pictureUrl: 'https://example.test/pic.jpg',
      lineUserId: 'z9y8x7w6',
    });
    render(<ChatHistoryDetail conversationId="conv-1" />);

    await screen.findByText('รับเรื่องแล้วครับ');
    expect(screen.getAllByText('สมหญิง').length).toBeGreaterThan(0);
    expect(screen.getByText('z9y8x7w6')).toBeInTheDocument();
    const payload = await fetchConversationPage.mock.results[0]?.value;
    expect(payload.conversation.displayName).toBe('สมหญิง');
    expect(payload.conversation.pictureUrl).toBe('https://example.test/pic.jpg');
    expect(payload.conversation.lineUserId).toBe('z9y8x7w6');
    expect(JSON.stringify(payload)).not.toContain(RAW_LINE_ID);
  });

  it('โหลดไม่สำเร็จแสดงข้อความไทย ไม่ใช่หน้าว่าง', async () => {
    fetchConversationPage.mockResolvedValue(null);
    render(<ChatHistoryDetail conversationId="conv-404" />);
    expect(await screen.findByRole('status')).toHaveTextContent('โหลดข้อมูลไม่สำเร็จ');
    expect(fetchConversations).not.toHaveBeenCalled();
  });
});

describe('mask audit — ไม่มี raw LINE id ใน response ที่ใช้', () => {
  it('lucky payload ที่ปน raw id มา (เช่น U...) ต้องล้มเหลวที่ assertion นี้เพื่อเตือนว่าต้องแก้ endpoint', async () => {
    const leaked: Conversation = conversation({ lineUserId: `${RAW_LINE_ID.slice(0, 8)}` });
    fetchConversations.mockResolvedValue([leaked]);
    render(<ChatHistoriesClient />);
    await screen.findByText('สมชาย');

    const payload = JSON.stringify(await fetchConversations.mock.results[0]?.value);
    expect(payload).not.toContain(RAW_LINE_ID);
  });
});
