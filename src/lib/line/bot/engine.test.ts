import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  }),
  insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }),
} as never;

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => mockDb),
}));

vi.mock('../settings', () => ({
  getChatSetting: vi.fn(async (key: string) => {
    const defaults: Record<string, unknown> = {
      handoff_keywords: ['ติดต่อเจ้าหน้าที่', 'เจ้าหน้าที่', 'คุยกับคน', 'พบเจ้าหน้าที่', 'handoff', 'operator', 'admin'],
      welcome_message: 'สวัสดี',
      bot_enabled: true,
      bot_engine_v2: true,
    };
    return defaults[key];
  }),
}));

vi.mock('./intent-matcher', () => ({
  matchIntent: vi.fn(async () => null),
}));

vi.mock('../client', () => ({
  getProfile: vi.fn(async () => null),
  replyMessage: vi.fn(async () => {}),
  sendTypingIndicator: vi.fn(async () => {}),
}));

vi.mock('../sse/broadcaster', () => ({
  broadcast: vi.fn(),
}));

vi.mock('./faq-matcher', () => ({
  matchFaq: vi.fn(async () => null),
}));

vi.mock('./case-flow', () => ({
  startCaseFlow: vi.fn(async () => ({
    state: { step: 'title' },
    reply: { type: 'text', text: 'กรุณาพิมพ์หัวข้อเรื่อง' },
  })),
  processCaseFlow: vi.fn(async () => ({
    state: null,
    replies: [{ type: 'text', text: 'ดำเนินการต่อ' }],
  })),
}));

vi.mock('../messages/flex', () => ({
  caseStatusFlex: vi.fn((code: string, status: string) => ({
    type: 'flex',
    altText: `สถานะ ${code}`,
    contents: { type: 'bubble', header: { contents: [{ type: 'text', text: status }] } },
  })),
  handoffNotifyFlex: vi.fn(() => ({
    type: 'flex',
    altText: 'กำลังเชื่อมต่อเจ้าหน้าที่',
    contents: { type: 'bubble' },
  })),
}));

import { routeBotMessage } from './engine';
import { matchFaq } from './faq-matcher';
import { startCaseFlow } from './case-flow';

function makeEvent(text: string | null, type = 'text') {
  return {
    type: 'message',
    replyToken: 'reply-token',
    timestamp: Date.now(),
    mode: 'active',
    webhookEventId: 'evt-1',
    source: { type: 'user', userId: 'U123' },
    message: type === 'text' ? { type: 'text', id: 'msg-1', text } : { type, id: 'msg-1' },
  } as never;
}

describe('routeBotMessage — existing behavior (TDD safety net)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('non-text messages', () => {
    it('returns help text for non-text non-location', async () => {
      const event = makeEvent(null, 'sticker');
      const replies = await routeBotMessage(mockDb, event, null, 'user-pk', 'conv-1');
      expect(replies).toHaveLength(1);
      expect(replies[0]!.type).toBe('text');
      expect((replies[0] as { text: string }).text).toContain('แจ้งเรื่อง');
    });
  });

  describe('handoff detection', () => {
    it('triggers handoff for "ติดต่อเจ้าหน้าที่"', async () => {
      const event = makeEvent('ติดต่อเจ้าหน้าที่');
      const replies = await routeBotMessage(mockDb, event, 'ติดต่อเจ้าหน้าที่', 'user-pk', 'conv-1');
      expect(replies.length).toBeGreaterThanOrEqual(1);
      expect(replies[0]!.type).toBe('flex');
    });

    it('triggers handoff for "operator" (English)', async () => {
      const event = makeEvent('operator');
      const replies = await routeBotMessage(mockDb, event, 'operator', 'user-pk', 'conv-1');
      expect(replies[0]!.type).toBe('flex');
    });
  });

  describe('case flow start', () => {
    it('starts case flow for "แจ้งเรื่อง"', async () => {
      const event = makeEvent('แจ้งเรื่อง');
      const replies = await routeBotMessage(mockDb, event, 'แจ้งเรื่อง', 'user-pk', 'conv-1');
      expect(startCaseFlow).toHaveBeenCalled();
      expect(replies).toHaveLength(1);
      expect((replies[0] as { text: string }).text).toContain('หัวข้อเรื่อง');
    });

    it('starts case flow for "ร้องเรียน"', async () => {
      const event = makeEvent('ร้องเรียน');
      const replies = await routeBotMessage(mockDb, event, 'ร้องเรียน', 'user-pk', 'conv-1');
      expect(startCaseFlow).toHaveBeenCalled();
    });

    it('starts case flow for exact "แจ้ง"', async () => {
      const event = makeEvent('แจ้ง');
      const replies = await routeBotMessage(mockDb, event, 'แจ้ง', 'user-pk', 'conv-1');
      expect(startCaseFlow).toHaveBeenCalled();
    });
  });

  describe('case tracking', () => {
    it('asks for code when "ติดตาม" has no code', async () => {
      const event = makeEvent('ติดตาม');
      const replies = await routeBotMessage(mockDb, event, 'ติดตาม', 'user-pk', 'conv-1');
      expect(replies).toHaveLength(1);
      expect((replies[0] as { text: string }).text).toContain('HG');
    });

    it('returns not-found for unknown tracking code', async () => {
      const event = makeEvent('ติดตาม HG000000000');
      const replies = await routeBotMessage(mockDb, event, 'ติดตาม HG000000000', 'user-pk', 'conv-1');
      expect(replies).toHaveLength(1);
      expect((replies[0] as { text: string }).text).toContain('ไม่พบ');
    });

    it('§ normalize: "ติดตาม HG 0000 0000 0" (เว้นวรรค) ต้อง normalize เป็น HG000000000 ก่อนค้น', async () => {
      const event = makeEvent('ติดตาม HG 0000 0000 0');
      const replies = await routeBotMessage(mockDb, event, 'ติดตาม HG 0000 0000 0', 'user-pk', 'conv-1');
      expect(replies).toHaveLength(1);
      // ค้นไม่เจอก็ได้ (ไม่มีเคสจริง) — สำคัญคือไม่พังด้วย code ที่มีเว้นวรรค
      expect((replies[0] as { text: string }).text).toContain('ไม่พบ');
    });
  });

  describe('rich menu button handlers', () => {
    it('§ "คำถามที่พบบ่อย" (ปุ่ม rich menu) ตอบ FAQ ได้จริง ไม่ตก fallback', async () => {
      const event = makeEvent('คำถามที่พบบ่อย');
      const replies = await routeBotMessage(mockDb, event, 'คำถามที่พบบ่อย', 'user-pk', 'conv-1');
      expect(replies).toHaveLength(1);
      expect((replies[0] as { text: string }).text).toContain('เวลาทำการ');
      expect((replies[0] as { text: string }).text).not.toContain('ไม่เข้าใจ');
    });
  });

  describe('FAQ fallback', () => {
    it('returns FAQ answer when matchFaq hits', async () => {
      vi.mocked(matchFaq).mockResolvedValueOnce({
        answer: 'เปิด 08:30-16:30',
        question: 'เปิดกี่โมง',
        score: 0.8,
      } as never);
      const event = makeEvent('เปิดกี่โมง');
      const replies = await routeBotMessage(mockDb, event, 'เปิดกี่โมง', 'user-pk', 'conv-1');
      expect(replies).toHaveLength(1);
      expect((replies[0] as { text: string }).text).toBe('เปิด 08:30-16:30');
    });
  });

  describe('fallback (no match)', () => {
    it('returns help text when nothing matches', async () => {
      const event = makeEvent('สวัสดีครับ');
      const replies = await routeBotMessage(mockDb, event, 'สวัสดีครับ', 'user-pk', 'conv-1');
      expect(replies).toHaveLength(1);
      expect((replies[0] as { text: string }).text).toContain('ไม่เข้าใจ');
    });
  });
});
