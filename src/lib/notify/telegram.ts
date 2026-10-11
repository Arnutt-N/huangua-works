import type { NotifyChannelResult } from './types';

/**
 * Telegram Bot API — sendMessage
 *
 * Env: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (ต้องมีทั้งคู่ ไม่งั้นข้ามการส่ง)
 *
 * § ไม่ hardcode token และไม่ log ค่า token/chat id — เหมือน LINE client ที่ไม่ log token
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const SEND_TIMEOUT_MS = 5_000;
/** Telegram รับข้อความสูงสุด 4096 ตัวอักษร */
const MAX_TEXT_LENGTH = 4_000;

export async function sendTelegram(text: string): Promise<NotifyChannelResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { status: 'skipped' };

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, MAX_TEXT_LENGTH) }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { status: 'failed', error: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { status: 'sent' };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}
