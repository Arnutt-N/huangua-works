import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpLineTransport } from './transport';
import { createRecordingTransport } from './recording-transport';

const TEXT = [{ type: 'text' as const, text: 'สวัสดีครับ' }];

describe('httpLineTransport (adapter prod — ห่อ client.ts)', () => {
  const fetchMock = vi.fn<typeof fetch>();

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('push → POST /message/push พร้อม to + messages', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));

    await httpLineTransport.push('U123', TEXT);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.line.me/v2/bot/message/push');
    expect(JSON.parse(String(init?.body))).toEqual({ to: 'U123', messages: TEXT });
  });

  it('reply → POST /message/reply พร้อม replyToken', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));

    await httpLineTransport.reply('rt-1', TEXT);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.line.me/v2/bot/message/reply');
    expect(JSON.parse(String(init?.body))).toEqual({ replyToken: 'rt-1', messages: TEXT });
  });

  it('push ที่ LINE ตอบ non-2xx ต้อง throw (message-service ใช้ตัดสิน pushStatus=failed)', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async () => new Response('boom', { status: 500 }));

    await expect(httpLineTransport.push('U123', TEXT)).rejects.toThrow('LINE API /message/push failed (500)');
  });
});

describe('createRecordingTransport (adapter เทสต์)', () => {
  it('บันทึกทุก call ตามลำดับ', async () => {
    const t = createRecordingTransport();
    await t.getProfile('U1');
    await t.showTyping('U1');
    await t.reply('rt', TEXT);
    await t.push('U1', TEXT);

    expect(t.calls).toEqual([
      { kind: 'profile', userId: 'U1' },
      { kind: 'typing', chatId: 'U1' },
      { kind: 'reply', replyToken: 'rt', messages: TEXT },
      { kind: 'push', to: 'U1', messages: TEXT },
    ]);
  });

  it('failNextPush ทำให้ push ครั้งถัดไป throw ครั้งเดียว แต่ยังบันทึก call', async () => {
    const t = createRecordingTransport();
    t.failNextPush();

    await expect(t.push('U1', TEXT)).rejects.toThrow('push ล้มเหลว (จำลอง)');
    await expect(t.push('U1', TEXT)).resolves.toBeUndefined();
    expect(t.calls.filter((c) => c.kind === 'push')).toHaveLength(2);
  });

  it('getProfile คืนค่าที่ตั้งด้วย setProfile (default null)', async () => {
    const t = createRecordingTransport();
    expect(await t.getProfile('U1')).toBeNull();
    t.setProfile({ userId: 'U1', displayName: 'สมชาย' } as never);
    expect(await t.getProfile('U1')).toMatchObject({ displayName: 'สมชาย' });
  });
});
