import type { NotifyChannelResult } from './types';

/**
 * POST JSON กลางของทุก channel — timeout + error contract ที่เดียว
 *
 * § domain คือการยิง POST-JSON-with-timeout หนึ่งแบบ ไม่ใช่สองโมดูลต่อ channel
 */

const SEND_TIMEOUT_MS = 5_000;

export async function postJson(url: string, body: unknown): Promise<NotifyChannelResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { status: 'failed', retryable: isRetryableStatus(res.status), error: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { status: 'sent' };
  } catch (error) {
    // § fetch reject = network/timeout → ลองใหม่ได้เสมอ
    return { status: 'failed', retryable: true, error: error instanceof Error ? error.message : String(error) };
  }
}

/** § 5xx/429 = ปลายทางรับพิษ/ล้น ลองใหม่ได้; 4xx อื่น = ถาวร (ข้อความผิด/ห้าม) ไม่ควรลอง */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
