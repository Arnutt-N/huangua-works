import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// § mock db แบบเดียวกับ engine.test.ts ของ c4 (select คืน [] = user/conversation ใหม่)
// set() แยกเป็นตัวแปรเพื่อตรวจ payload unreadAdmin ที่ recordInboundMessage เขียน
const setMock = vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'conv-1' }]) })) }));
const mockDb = {
  select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => [] }) }) })),
  insert: vi.fn(() => ({ values: vi.fn(() => ({})) })),
  update: vi.fn(() => ({ set: setMock })),
} as never;

const BASE_SETTINGS: Record<string, unknown> = {
  handoff_keywords: ['ติดต่อเจ้าหน้าที่'],
  welcome_message: 'สวัสดี',
  bot_enabled: true,
  bot_engine_v2: false,
  business_hours: { start: '08:30', end: '16:30', days: [1, 2, 3, 4, 5] },
};
let settings: Record<string, unknown> = { ...BASE_SETTINGS };

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => mockDb) }));
vi.mock('../settings', () => ({
  getChatSetting: vi.fn(async (key: string) => settings[key]),
}));
vi.mock('./intent-matcher', () => ({ matchIntent: vi.fn(async () => null) }));
vi.mock('./faq-matcher', () => ({ matchFaq: vi.fn(async () => null) }));
vi.mock('../sse/broadcaster', () => ({ broadcast: vi.fn() }));
vi.mock('../messages/flex', () => ({
  caseStatusFlex: vi.fn(() => ({ type: 'flex', altText: 'สถานะ', contents: { type: 'bubble' } })),
  handoffNotifyFlex: vi.fn(() => ({ type: 'flex', altText: 'กำลังเชื่อมต่อเจ้าหน้าที่', contents: { type: 'bubble' } })),
}));
vi.mock('@/lib/cases/citizen-access', () => ({
  findTrackableCase: vi.fn(async () => null),
}));

// กัน default transport ยิง LINE จริง — ทุก test ต้องส่ง recording transport เข้า handleEvent
vi.stubGlobal(
  'fetch',
  vi.fn(async () => {
    throw new Error('ห้ามยิง LINE จริงจาก unit test — ส่ง transport เข้า handleEvent');
  }),
);

import { BOT_DISABLED_TEXT, handleEvent, routeBotMessage } from './engine';
import { matchFaq } from './faq-matcher';
import { broadcast } from '../sse/broadcaster';
import { createRecordingTransport } from '../conversation/recording-transport';

afterAll(() => {
  vi.unstubAllGlobals();
});

const MON_1000_TH = new Date('2026-10-05T03:00:00Z');
const SAT_1000_TH = new Date('2026-10-10T03:00:00Z');

function textEvent(text: string) {
  return {
    type: 'message',
    replyToken: 'reply-token',
    timestamp: Date.now(),
    mode: 'active',
    webhookEventId: 'evt-1',
    source: { type: 'user', userId: 'U123' },
    message: { type: 'text', id: 'msg-1', text },
  } as never;
}

function conversationUpdatePayload(): Record<string, unknown> {
  // set() ครั้งแรกใน handleMessageEvent คือการอัปเดต lastMessage/unreadAdmin ของ conversation
  const call = setMock.mock.calls[0] as unknown as [Record<string, unknown>] | undefined;
  if (!call) throw new Error('ไม่มีการอัปเดต conversation');
  return call[0];
}

function repliesOf(transport: ReturnType<typeof createRecordingTransport>) {
  return transport.calls.filter((c) => c.kind === 'reply');
}

beforeEach(() => {
  vi.clearAllMocks();
  settings = { ...BASE_SETTINGS };
});

describe('handleEvent — bot_enabled', () => {
  it('บอทเปิด: ส่งต่อให้บอทตอบ และ unreadAdmin = 0', async () => {
    const transport = createRecordingTransport();

    await handleEvent(textEvent('สวัสดีครับ'), transport);

    expect(transport.calls.filter((c) => c.kind === 'typing')).toHaveLength(1);
    expect(matchFaq).toHaveBeenCalledTimes(1);
    expect(conversationUpdatePayload().unreadAdmin).toBe(0);
    expect(repliesOf(transport)).toHaveLength(1);
  });

  it('บอทปิด: ไม่เข้า routeBotMessage, ย้ายห้องไป waiting_handoff, ตอบแจ้งครั้งเดียว', async () => {
    settings = { ...BASE_SETTINGS, bot_enabled: false };
    const transport = createRecordingTransport();

    await handleEvent(textEvent('สวัสดีครับ'), transport);

    expect(transport.calls.filter((c) => c.kind === 'typing')).toHaveLength(0);
    expect(matchFaq).not.toHaveBeenCalled();
    expect(conversationUpdatePayload().unreadAdmin).not.toBe(0);
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: expect.any(String),
      payload: { mode: 'waiting_handoff' },
    });
    const replies = repliesOf(transport);
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ replyToken: 'reply-token', messages: [{ type: 'text', text: BOT_DISABLED_TEXT }] });
  });
});

describe('routeBotMessage — business_hours ที่ทางแยก handoff', () => {
  it('ในเวลาทำการ: handoff ตามปกติ (flex แจ้งเจ้าหน้าที่ + broadcast mode_change)', async () => {
    const replies = await routeBotMessage(
      mockDb, textEvent('ติดต่อเจ้าหน้าที่'), 'ติดต่อเจ้าหน้าที่', 'user-pk', 'conv-1', MON_1000_TH,
    );

    expect(replies[0]!.type).toBe('flex');
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: 'conv-1',
      payload: { mode: 'waiting_handoff' },
    });
  });

  it('นอกเวลาทำการ: ตอบข้อความนอกเวลา และไม่เปลี่ยน mode', async () => {
    const replies = await routeBotMessage(
      mockDb, textEvent('ติดต่อเจ้าหน้าที่'), 'ติดต่อเจ้าหน้าที่', 'user-pk', 'conv-1', SAT_1000_TH,
    );

    expect(replies).toHaveLength(1);
    expect((replies[0] as { text: string }).text).toContain('นอกเวลาทำการ');
    expect(broadcast).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mode_change', conversationId: 'conv-1' }),
    );
  });

  it('นอกเวลาทำการ: ติดตามสถานะยังใช้ได้', async () => {
    const replies = await routeBotMessage(
      mockDb, textEvent('ติดตาม'), 'ติดตาม', 'user-pk', 'conv-1', SAT_1000_TH,
    );

    expect((replies[0] as { text: string }).text).toContain('HG');
  });
});
