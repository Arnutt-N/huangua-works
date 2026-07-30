import type { LineOutgoingMessage, LineProfile } from './types';

const LINE_API_BASE = 'https://api.line.me/v2/bot';

export class LineApiError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    detail: string,
  ) {
    super(`LINE API ${endpoint} failed (${status}): ${detail}`);
    this.name = 'LineApiError';
  }
}

function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
  };
}

async function postLine(endpoint: string, payload: unknown): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError(endpoint, res.status, detail.slice(0, 500));
  }
}

export async function replyMessage(replyToken: string, messages: LineOutgoingMessage[]): Promise<void> {
  await postLine('/message/reply', { replyToken, messages });
}

export async function pushMessage(to: string, messages: LineOutgoingMessage[]): Promise<void> {
  await postLine('/message/push', { to, messages });
}

export async function sendTypingIndicator(chatId: string, loadingSeconds = 10): Promise<void> {
  // best-effort — indicator พังไม่ควรล้ม flow ตอบข้อความ
  try {
    await postLine('/chat/loading/start', { chatId, loadingSeconds });
  } catch (error) {
    console.warn('[line] typing indicator failed', error);
  }
}

export async function getProfile(userId: string): Promise<LineProfile | null> {
  const res = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) return null;
  return res.json();
}
