import { postJson } from './sender';
import type { NotifyChannelResult } from './types';

/**
 * Telegram Bot API — sendMessage
 *
 * Env: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (ต้องมีทั้งคู่ ไม่งั้นข้ามการส่ง)
 *
 * § ไม่ hardcode token และไม่ log ค่า token/chat id — เหมือน LINE client ที่ไม่ log token
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';
/** Telegram รับข้อความสูงสุด 4096 ตัวอักษร */
const MAX_TEXT_LENGTH = 4_000;

export async function sendTelegram(text: string): Promise<NotifyChannelResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { status: 'skipped' };

  return postJson(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    chat_id: chatId,
    text: text.slice(0, MAX_TEXT_LENGTH),
  });
}
