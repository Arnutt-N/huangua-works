import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_PROVIDERS, probeProvider } from './probe';

describe('probeProvider', () => {
  beforeEach(() => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    vi.stubEnv('TELEGRAM_CHAT_ID', '');
    vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', '');
    vi.stubEnv('S3_ENDPOINT', '');
    vi.stubEnv('SMTP_HOST', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('มี providers ครบ 4 ตัว', () => {
    expect(CONNECTION_PROVIDERS).toEqual(['line', 's3', 'smtp', 'telegram']);
  });

  describe('telegram probe', () => {
    it('ไม่ตั้งค่า TELEGRAM_BOT_TOKEN คืน unknown', async () => {
      const res = await probeProvider('telegram');
      expect(res).toEqual({
        status: 'unknown',
        endpoint: 'https://api.telegram.org',
      });
    });

    it('ตั้งค่า TELEGRAM_BOT_TOKEN แต่ไม่ตั้งค่า TELEGRAM_CHAT_ID คืน unknown', async () => {
      vi.stubEnv('TELEGRAM_BOT_TOKEN', '123456:ABC-DEF');
      const res = await probeProvider('telegram');
      expect(res).toEqual({
        status: 'unknown',
        endpoint: 'https://api.telegram.org',
      });
    });

    it('ตั้งค่า token และ chat_id และ Telegram getMe ตอบ 200 คืน connected', async () => {
      vi.stubEnv('TELEGRAM_BOT_TOKEN', '123456:ABC-DEF');
      vi.stubEnv('TELEGRAM_CHAT_ID', '-1001234567890');
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);

      const res = await probeProvider('telegram');
      expect(res).toEqual({
        status: 'connected',
        endpoint: 'https://api.telegram.org',
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/bot123456:ABC-DEF/getMe',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('ตั้งค่า token แต่ Telegram getMe ตอบ 401 คืน degraded', async () => {
      vi.stubEnv('TELEGRAM_BOT_TOKEN', 'INVALID_TOKEN');
      vi.stubEnv('TELEGRAM_CHAT_ID', '-1001234567890');
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 401 }));
      vi.stubGlobal('fetch', fetchMock);

      const res = await probeProvider('telegram');
      expect(res).toEqual({
        status: 'degraded',
        endpoint: 'https://api.telegram.org',
      });
    });

    it('เกิดข้อผิดพลาดในการเชื่อมต่อ (fetch throws) คืน degraded ไม่ throw', async () => {
      vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TOKEN');
      vi.stubEnv('TELEGRAM_CHAT_ID', '-1001234567890');
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection timed out')));

      const res = await probeProvider('telegram');
      expect(res).toEqual({
        status: 'degraded',
        endpoint: 'https://api.telegram.org',
      });
    });
  });

  describe('line probe', () => {
    it('ไม่ตั้งค่า token คืน unknown', async () => {
      const res = await probeProvider('line');
      expect(res).toEqual({
        status: 'unknown',
        endpoint: 'https://api.line.me',
      });
    });

    it('ตั้งค่า token และ LINE API ตอบ 200 คืน connected', async () => {
      vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', 'LINE_TOKEN');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

      const res = await probeProvider('line');
      expect(res).toEqual({
        status: 'connected',
        endpoint: 'https://api.line.me',
      });
    });
  });
});
