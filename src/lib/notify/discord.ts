import { postJson } from './sender';
import type { NotifyChannelResult } from './types';

/**
 * Discord webhook — ส่งข้อความลง channel ผ่าน Incoming Webhook
 *
 * Env: DISCORD_WEBHOOK_URL (ตัวเดียวจบ — ถ้าไม่ตั้งถือว่าปิดช่องทางนี้)
 *
 * § ไม่ log webhook URL — path ของ webhook ใช้ส่งข้อความแทนเจ้าของได้
 */

/** Discord รับ content สูงสุด 2000 ตัวอักษร */
const MAX_CONTENT_LENGTH = 2_000;

export async function sendDiscord(text: string): Promise<NotifyChannelResult> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return { status: 'skipped' };

  return postJson(webhookUrl, { content: text.slice(0, MAX_CONTENT_LENGTH) });
}
