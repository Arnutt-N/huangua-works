import type { NotifyChannelResult } from './types';

/**
 * Discord webhook — ส่งข้อความลง channel ผ่าน Incoming Webhook
 *
 * Env: DISCORD_WEBHOOK_URL (ตัวเดียวจบ — ถ้าไม่ตั้งถือว่าปิดช่องทางนี้)
 *
 * § ไม่ log webhook URL — path ของ webhook ใช้ส่งข้อความแทนเจ้าของได้
 */

const SEND_TIMEOUT_MS = 5_000;
/** Discord รับ content สูงสุด 2000 ตัวอักษร */
const MAX_CONTENT_LENGTH = 2_000;

export async function sendDiscord(text: string): Promise<NotifyChannelResult> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return { status: 'skipped' };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text.slice(0, MAX_CONTENT_LENGTH) }),
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
