import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendTelegram } from './telegram';
import { sendDiscord } from './discord';
import { buildNewCaseNoticeText, notifyNewCase, sendNotification } from './index';

/**
 * notify (Telegram/Discord) — unit test ด้วย fetch mock เท่านั้น
 *
 * § ห้ามยิง API จริง — ทุกเคส stub global fetch + stub env ด้วยค่าปลอม
 */

beforeEach(() => {
  // § เคลียร์ env ทุกตัวก่อนทุกเคส — vitest.setup โหลด .env.local เข้า process.env
  // ถ้าเครื่อง dev มี token จริง เคส "ไม่ตั้ง env" จะไม่ skipped แล้วยิงของจริง
  vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
  vi.stubEnv('TELEGRAM_CHAT_ID', '');
  vi.stubEnv('DISCORD_WEBHOOK_URL', '');
  // § ปลด guard NODE_ENV=test ของ sendNotification — ไฟล์นี้ stub fetch ทุกเคสอยู่แล้ว
  vi.stubEnv('NOTIFY_ENABLE_IN_TEST', 'true');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function okResponse(body = '{}', status = 200) {
  return new Response(body, { status });
}

describe('sendTelegram', () => {
  it('ไม่ตั้ง TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID → skipped ไม่ยิง fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendTelegram('สวัสดี');

    expect(result).toEqual({ status: 'skipped' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('env ครบ → POST /bot<token>/sendMessage พร้อม chat_id + text', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TEST_TOKEN');
    vi.stubEnv('TELEGRAM_CHAT_ID', 'CHAT1');
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendTelegram('สวัสดี');

    expect(result).toEqual({ status: 'sent' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botTEST_TOKEN/sendMessage');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ chat_id: 'CHAT1', text: 'สวัสดี' });
  });

  it('HTTP 500 → failed ไม่ throw', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TEST_TOKEN');
    vi.stubEnv('TELEGRAM_CHAT_ID', 'CHAT1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));

    const result = await sendTelegram('สวัสดี');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('500');
  });

  it('ตัดข้อความเกิน 4000 ตัวอักษร', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TEST_TOKEN');
    vi.stubEnv('TELEGRAM_CHAT_ID', 'CHAT1');
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await sendTelegram('x'.repeat(5000));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { text: string };
    expect(body.text).toHaveLength(4000);
  });
});

describe('sendDiscord', () => {
  it('ไม่ตั้ง DISCORD_WEBHOOK_URL → skipped ไม่ยิง fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendDiscord('สวัสดี');

    expect(result).toEqual({ status: 'skipped' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('env ครบ → POST webhook พร้อม content', async () => {
    vi.stubEnv('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/TEST/SECRET');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendDiscord('สวัสดี');

    expect(result).toEqual({ status: 'sent' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://discord.com/api/webhooks/TEST/SECRET');
    expect(JSON.parse(init.body as string)).toEqual({ content: 'สวัสดี' });
  });

  it('fetch reject (network) → failed ไม่ throw', async () => {
    vi.stubEnv('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/TEST/SECRET');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

    const result = await sendDiscord('สวัสดี');

    expect(result.status).toBe('failed');
  });

  it('ตัด content เกิน 2000 ตัวอักษร', async () => {
    vi.stubEnv('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/TEST/SECRET');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendDiscord('x'.repeat(3000));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { content: string };
    expect(body.content).toHaveLength(2000);
  });
});

describe('sendNotification', () => {
  it('env ครบสองช่องทาง → ส่งทั้งคู่และคืนผล sent/sent', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TEST_TOKEN');
    vi.stubEnv('TELEGRAM_CHAT_ID', 'CHAT1');
    vi.stubEnv('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/TEST/SECRET');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const results = await sendNotification({ subject: 'เรื่องร้องเรียนใหม่', message: 'รายละเอียด' });

    expect(results).toEqual([
      { channel: 'telegram', status: 'sent' },
      { channel: 'discord', status: 'sent' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ไม่มี env เลย → ทั้งคู่ skipped ไม่ throw', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const results = await sendNotification({ subject: 'หัวข้อ', message: 'รายละเอียด' });

    expect(results.map((r) => r.status)).toEqual(['skipped', 'skipped']);
  });

  it('ช่องทางนึงพัง อีกนึงรอด → คืนผล mixed โดยไม่ throw', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TEST_TOKEN');
    vi.stubEnv('TELEGRAM_CHAT_ID', 'CHAT1');
    vi.stubEnv('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/TEST/SECRET');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 })) // telegram
      .mockResolvedValueOnce(new Response(null, { status: 204 })); // discord
    vi.stubGlobal('fetch', fetchMock);

    const results = await sendNotification({ subject: 'หัวข้อ', message: 'รายละเอียด' });

    expect(results[0]).toMatchObject({ channel: 'telegram', status: 'failed' });
    expect(results[1]).toMatchObject({ channel: 'discord', status: 'sent' });
  });
});

describe('notifyNewCase', () => {
  const notice = {
    trackingCode: 'TRK-2569-0001',
    title: 'ถนนชำรุด',
    categoryName: 'ถนน-ทางเท้า',
    channel: 'web' as const,
    location: 'หมู่ 2',
  };

  it('buildNewCaseNoticeText รวมหัวข้อ เลขอ้างอิง หมวดหมู่ ช่องทาง สถานที่', () => {
    expect(buildNewCaseNoticeText(notice)).toBe(
      [
        'หัวข้อ: ถนนชำรุด',
        'เลขอ้างอิง: TRK-2569-0001',
        'หมวดหมู่: ถนน-ทางเท้า',
        'ช่องทาง: เว็บไซต์',
        'สถานที่: หมู่ 2',
      ].join('\n'),
    );
    const lineNotice = buildNewCaseNoticeText({ ...notice, channel: 'line', location: undefined });
    expect(lineNotice).toContain('ช่องทาง: LINE');
    expect(lineNotice).toContain('สถานที่: -');
  });

  it('ส่งข้อความไทยไปสองช่องทางเมื่อ env ครบ', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TEST_TOKEN');
    vi.stubEnv('TELEGRAM_CHAT_ID', 'CHAT1');
    vi.stubEnv('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/TEST/SECRET');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const results = await notifyNewCase(notice);

    expect(results.map((r) => r.status)).toEqual(['sent', 'sent']);
    const [, telegramInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const telegramBody = JSON.parse(telegramInit.body as string) as { text: string };
    expect(telegramBody.text).toContain('เรื่องร้องเรียนใหม่');
    expect(telegramBody.text).toContain('TRK-2569-0001');
  });

  it('fail-open: fetch reject ทุกช่องทางก็ไม่ throw', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TEST_TOKEN');
    vi.stubEnv('TELEGRAM_CHAT_ID', 'CHAT1');
    vi.stubEnv('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/TEST/SECRET');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

    await expect(notifyNewCase(notice)).resolves.toEqual([
      { channel: 'telegram', status: 'failed', error: 'network down' },
      { channel: 'discord', status: 'failed', error: 'network down' },
    ]);
  });
});
