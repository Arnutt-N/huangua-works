import type { LineOutgoingMessage, LineProfile } from './types';

export const LINE_API_BASE = 'https://api.line.me/v2/bot';
export const LINE_DATA_BASE = 'https://api-data.line.me/v2/bot';

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

export function getHeaders(): HeadersInit {
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

export async function broadcastMessage(messages: LineOutgoingMessage[]): Promise<void> {
  await postLine('/message/broadcast', { messages });
}

export async function multicast(userIds: string[], messages: LineOutgoingMessage[]): Promise<void> {
  await postLine('/message/multicast', { to: userIds, messages });
}

export interface FollowerIdsResponse {
  userIds: string[];
  next?: string;
}

export async function getFollowerIds(limit = 1000, start?: string): Promise<FollowerIdsResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (start) params.set('start', start);

  const res = await fetch(`${LINE_API_BASE}/followers/ids?${params}`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError('/followers/ids', res.status, detail.slice(0, 500));
  }
  return res.json();
}

export async function createLineRichMenu(config: unknown): Promise<string> {
  const res = await fetch(`${LINE_API_BASE}/richmenu`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError('/richmenu', res.status, detail.slice(0, 500));
  }
  const data = await res.json();
  return data.richMenuId;
}

export async function uploadLineRichMenuImage(richMenuId: string, imageBuffer: Buffer): Promise<void> {
  const res = await fetch(`${LINE_DATA_BASE}/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: new Uint8Array(imageBuffer),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError(`/richmenu/${richMenuId}/content`, res.status, detail.slice(0, 500));
  }
}

export async function setDefaultLineRichMenu(richMenuId: string): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError(`/user/all/richmenu/${richMenuId}`, res.status, detail.slice(0, 500));
  }
}
