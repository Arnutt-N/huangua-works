import type { LineOutgoingMessage, LineProfile } from './types';

const LINE_API_BASE = 'https://api.line.me/v2/bot';

function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
  };
}

export async function replyMessage(replyToken: string, messages: LineOutgoingMessage[]): Promise<void> {
  await fetch(`${LINE_API_BASE}/message/reply`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ replyToken, messages }),
  });
}

export async function pushMessage(to: string, messages: LineOutgoingMessage[]): Promise<void> {
  await fetch(`${LINE_API_BASE}/message/push`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ to, messages }),
  });
}

export async function sendTypingIndicator(chatId: string, loadingSeconds = 10): Promise<void> {
  await fetch(`${LINE_API_BASE}/chat/loading/start`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ chatId, loadingSeconds }),
  });
}

export async function getProfile(userId: string): Promise<LineProfile | null> {
  const res = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
    headers: getHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}
