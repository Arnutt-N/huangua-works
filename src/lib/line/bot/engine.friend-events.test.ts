import { beforeEach, describe, expect, it, vi } from 'vitest';

// § เทสต์ friend events ของ engine — ตรวจว่า follow/unfollow บันทึก event ผ่าน friend-events
// และ follow ยังส่ง welcome เหมือนเดิม ส่วน redelivery ไม่ซ้ำอยู่ระดับ friend-events (unique)

const recordMock = vi.hoisted(() => vi.fn(async () => true));
const followCountMock = vi.hoisted(() => vi.fn(async () => 3));

vi.mock('../friend-events', () => ({
  recordFriendEvent: recordMock,
  getFollowCount: followCountMock,
}));

const cannedRow = {
  id: 'user-pk-1',
  lineUserId: 'U123',
  displayName: 'ผู้ใช้ทดสอบ',
  botState: null,
  metadata: { profileCheckedAt: new Date().toISOString() },
};

const mockDb = {
  select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => [cannedRow] }) }) })),
  insert: vi.fn(() => ({ values: vi.fn(() => ({})) })),
  update: vi.fn(() => ({ set: () => ({ where: () => ({}) }) })),
};

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => mockDb),
}));

vi.mock('../settings', () => ({
  getChatSetting: vi.fn(async (key: string) =>
    key === 'welcome_message' ? 'สวัสดี {display_name} ครั้งที่ {follow_count}' : true,
  ),
}));

vi.mock('./intent-matcher', () => ({ matchIntent: vi.fn(async () => null) }));
vi.mock('./faq-matcher', () => ({ matchFaq: vi.fn(async () => null) }));
vi.mock('../sse/broadcaster', () => ({ broadcast: vi.fn() }));
vi.mock('./case-flow', () => ({
  startCaseFlow: vi.fn(),
  processCaseFlow: vi.fn(),
  handleConfirmPostback: vi.fn(async () => null),
}));
vi.mock('@/lib/cases/citizen-access', () => ({ findTrackableCase: vi.fn(async () => null) }));

import { handleEvent } from './engine';
import { createRecordingTransport } from '../conversation/recording-transport';

function friendEvent(type: 'follow' | 'unfollow', webhookEventId: string) {
  return {
    type,
    ...(type === 'follow' ? { replyToken: 'reply-follow' } : {}),
    timestamp: Date.now(),
    mode: 'active',
    webhookEventId,
    source: { type: 'user', userId: 'U123' },
  } as never;
}

describe('handleEvent · friend events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordMock.mockResolvedValue(true);
    followCountMock.mockResolvedValue(3);
  });

  it('follow บันทึก event แล้วส่ง welcome พร้อม follow_count', async () => {
    const transport = createRecordingTransport();
    await handleEvent(friendEvent('follow', 'evt-follow-1'), transport);
    expect(recordMock).toHaveBeenCalledWith(expect.anything(), 'user-pk-1', 'follow', 'evt-follow-1');
    const reply = transport.calls.find((c) => c.kind === 'reply');
    expect(reply?.kind).toBe('reply');
    if (reply?.kind === 'reply') expect((reply.messages[0] as { text?: string }).text).toContain('ครั้งที่ 3');
  });

  it('unfollow บันทึก event อย่างเดียว ไม่ตอบกลับ', async () => {
    const transport = createRecordingTransport();
    await handleEvent(friendEvent('unfollow', 'evt-unfollow-1'), transport);
    expect(recordMock).toHaveBeenCalledWith(expect.anything(), 'user-pk-1', 'unfollow', 'evt-unfollow-1');
    expect(transport.calls.filter((c) => c.kind === 'reply' || c.kind === 'push')).toHaveLength(0);
  });

  it('recordFriendEvent ล้มไม่ล้ม welcome', async () => {
    recordMock.mockRejectedValue(new Error('db down'));
    followCountMock.mockRejectedValue(new Error('db down'));
    const transport = createRecordingTransport();
    await handleEvent(friendEvent('follow', 'evt-follow-2'), transport);
    expect(transport.calls.filter((c) => c.kind === 'reply')).toHaveLength(1);
  });
});
