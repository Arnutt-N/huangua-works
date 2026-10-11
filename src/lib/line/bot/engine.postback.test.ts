import { beforeEach, describe, expect, it, vi } from 'vitest';

// § เทสต์สาย postback ของ engine แยกไฟล์จาก engine.test.ts — mock ./case-flow ทั้งก้อน
// แล้วตรวจ wiring (parse → handler → persist → reply ผ่าน transport) ไม่ใช่ logic ข้างใน

const CONFIRM_STATE = {
  step: 'confirm',
  categoryId: 'cat-road',
  categoryName: 'ถนน-ทางเท้า',
  title: 'ถนนพัง',
  description: 'มีหลุมบ่อใหญ่',
  location: 'หน้าวัด ม.3',
};

const cannedRow = {
  id: 'row-1',
  lineUserId: 'U123',
  displayName: 'ผู้ใช้ทดสอบ',
  botState: CONFIRM_STATE,
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
  getChatSetting: vi.fn(async (key: string) => {
    const defaults: Record<string, unknown> = { bot_enabled: true };
    return defaults[key];
  }),
}));

vi.mock('./intent-matcher', () => ({
  matchIntent: vi.fn(async () => null),
}));

vi.mock('./faq-matcher', () => ({
  matchFaq: vi.fn(async () => null),
}));

vi.mock('../sse/broadcaster', () => ({
  broadcast: vi.fn(),
}));

vi.mock('./case-flow', () => ({
  startCaseFlow: vi.fn(),
  processCaseFlow: vi.fn(),
  handleConfirmPostback: vi.fn(async () => null),
}));

vi.mock('@/lib/cases/citizen-access', () => ({
  findTrackableCase: vi.fn(async () => null),
}));

import { handleEvent } from './engine';
import { handleConfirmPostback } from './case-flow';
import { createRecordingTransport } from '../conversation/recording-transport';

function postbackEvent(data: string) {
  return {
    type: 'postback',
    replyToken: 'reply-token-pb',
    timestamp: Date.now(),
    mode: 'active',
    webhookEventId: 'evt-pb-1',
    source: { type: 'user', userId: 'U123' },
    postback: { data },
  } as never;
}

describe('handleEvent · postback confirm:* dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirm:ok → เข้า case flow, persist ก่อน, ตอบผ่าน transport (replyToken เดิม)', async () => {
    vi.mocked(handleConfirmPostback).mockResolvedValueOnce({
      state: null,
      replies: [{ type: 'text', text: 'ส่งเรื่องเรียบร้อยแล้ว' }],
    });
    const transport = createRecordingTransport();

    await handleEvent(postbackEvent('confirm:ok'), transport);

    expect(handleConfirmPostback).toHaveBeenCalledWith(
      'confirm:ok',
      expect.objectContaining({ step: 'confirm' }),
      'U123',
    );
    // § persist-ก่อน-reply: insert มีทั้งแถว log postback และแถวคำตอบบอท
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
    const replies = transport.calls.filter((c) => c.kind === 'reply');
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ replyToken: 'reply-token-pb' });
  });

  it('confirm:edit:title → ส่งคำถามช่องนั้นกลับผ่าน transport', async () => {
    vi.mocked(handleConfirmPostback).mockResolvedValueOnce({
      state: { ...CONFIRM_STATE, step: 'title', editingField: 'title' },
      replies: [{ type: 'text', text: 'กรุณาพิมพ์หัวข้อเรื่อง' }],
    });
    const transport = createRecordingTransport();

    await handleEvent(postbackEvent('confirm:edit:title'), transport);

    expect(handleConfirmPostback).toHaveBeenCalledWith(
      'confirm:edit:title',
      expect.objectContaining({ step: 'confirm' }),
      'U123',
    );
    expect(transport.calls.filter((c) => c.kind === 'reply')).toHaveLength(1);
  });

  it('postback อื่นคงพฤติกรรมเดิม: log only — ไม่เข้า case flow ไม่ตอบ', async () => {
    const transport = createRecordingTransport();

    await handleEvent(postbackEvent('richmenu:faq'), transport);

    expect(handleConfirmPostback).not.toHaveBeenCalled();
    expect(transport.calls.filter((c) => c.kind === 'reply')).toHaveLength(0);
    // แถว log postback ยังถูกบันทึกแถวเดียว
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('handler คืน null (พ้น confirm step แล้ว) → ไม่ตอบซ้ำ', async () => {
    vi.mocked(handleConfirmPostback).mockResolvedValueOnce(null);
    const transport = createRecordingTransport();

    await handleEvent(postbackEvent('confirm:ok'), transport);

    expect(transport.calls.filter((c) => c.kind === 'reply')).toHaveLength(0);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});
