import type { LineOutgoingMessage, LineProfile } from './types';
import { withLineCircuit } from './circuit-breaker';

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
  // § circuit breaker ห่อทุก POST — LINE ล่ม 5 ครั้งติด open 30s แล้ว fast-fail
  await withLineCircuit(endpoint, async () => {
    const res = await fetch(`${LINE_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new LineApiError(endpoint, res.status, detail.slice(0, 500));
    }
  });
}

/**
 * ดึง binary content ของข้อความที่ประชาชนส่ง (รูป/ไฟล์/วิดีโอ/เสียง) จาก LINE data API
 * มี timeout เสมอ (สื่อช้าห้ามดึง webhook ค้าง) และคืน content-length ให้ caller ตัดก่อนบัฟเฟอร์
 */
const MAX_CONTENT_BYTES = 10 * 1024 * 1024;
const CONTENT_TIMEOUT_MS = 20000;

/** ไฟล์ใหญ่เกินเพดาน (header หรือกลาง stream) — ไม่ใช่ LINE ล้ม เรียกแยกจาก LineApiError */
export class ContentTooLargeError extends Error {
  constructor(detail: string) {
    super(`content เกินเพดาน: ${detail}`);
    this.name = 'ContentTooLargeError';
  }
}
export async function getMessageContent(
  messageId: string,
): Promise<{ bytes: Uint8Array; contentType: string | null; contentLength: number | null }> {
  return withLineCircuit('/message/content', async () => {
    const res = await fetch(`${LINE_DATA_BASE}/message/${encodeURIComponent(messageId)}/content`, {
      headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(CONTENT_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new LineApiError('/message/content', res.status, detail.slice(0, 500));
    }
    const lengthHeader = res.headers.get('content-length');
    const contentLength = lengthHeader !== null && lengthHeader !== '' ? Number(lengthHeader) : null;
    if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_CONTENT_BYTES) {
      throw new ContentTooLargeError(`content-length ${contentLength} เกินเพดาน`);
    }
    // § อ่านแบบ bounded stream ไม่ใช่ arrayBuffer ทั้งก้อน — ไฟล์ใหญ่เกินเพดานต้องตัดตั้งแต่กลางทาง
    // ไม่ใช่บัฟเฟอร์ครบแล้วค่อยทิ้ง (OOM vector บน public webhook)
    const reader = res.body?.getReader();
    if (!reader) throw new LineApiError('/message/content', 500, 'no body');
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_CONTENT_BYTES) {
        await reader.cancel().catch(() => {});
        throw new ContentTooLargeError(`body เกินเพดาน ${MAX_CONTENT_BYTES}`);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      bytes,
      contentType: res.headers.get('content-type'),
      contentLength: contentLength !== null && Number.isFinite(contentLength) ? contentLength : null,
    };
  });
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

/**
 * § LINE ตรวจ Content-Type กับ magic bytes ของรูป — client-side auto-fit แปลงเป็น JPEG
 * ได้ จึงต้อง sniff จาก buffer ไม่ใช่ hardcode image/png (ไม่งั้น 400 ทั้งที่รูปถูกต้อง)
 */
function sniffImageContentType(buf: Uint8Array): 'image/png' | 'image/jpeg' {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  return 'image/jpeg';
}

export async function uploadLineRichMenuImage(richMenuId: string, imageBuffer: Buffer): Promise<void> {
  const res = await fetch(`${LINE_DATA_BASE}/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Content-Type': sniffImageContentType(imageBuffer),
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: new Uint8Array(imageBuffer),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError(`/richmenu/${richMenuId}/content`, res.status, detail.slice(0, 500));
  }
}

export async function getLineRichMenuImage(
  richMenuId: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  return withLineCircuit('/richmenu/content/get', async () => {
    const res = await fetch(`${LINE_DATA_BASE}/richmenu/${richMenuId}/content`, {
      headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new LineApiError(`/richmenu/${richMenuId}/content`, res.status, detail.slice(0, 500));
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, contentType: res.headers.get('content-type') ?? 'image/png' };
  });
}

export async function getLineRichMenu(richMenuId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${LINE_API_BASE}/richmenu/${richMenuId}`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  // § id เก่าที่โดนลบบน LINE = stale — คืน null ให้ caller สร้างใหม่แทนค้าง
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError(`/richmenu/${richMenuId}`, res.status, detail.slice(0, 500));
  }
  return res.json();
}

export async function deleteLineRichMenu(richMenuId: string): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/richmenu/${richMenuId}`, {
    method: 'DELETE',
    headers: getHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  // § ลบซ้ำ/โดนลบไปแล้ว = สำเร็จแบบ idempotent ไม่ต้อง throw
  if (res.status === 404) return;
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError(`/richmenu/${richMenuId}`, res.status, detail.slice(0, 500));
  }
}

// § LINE ไม่ส่ง impression/clicks กลับมาเมื่อผู้ใช้ไม่ถึง 20 คน — caller
// จึงต้องตีความ `impression` ที่หายไปเป็น privacy_restricted เอง
async function getRichMenuInsight(
  richMenuId: string,
  kind: 'summary' | 'daily',
  from: string,
  to: string,
): Promise<Record<string, unknown>> {
  const url = `${LINE_API_BASE}/insight/richmenu/${encodeURIComponent(richMenuId)}/${kind}?from=${from}&to=${to}`;
  const res = await fetch(url, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError(`/insight/richmenu/${kind}`, res.status, detail.slice(0, 500));
  }
  const data = (await res.json()) as Record<string, unknown>;
  return { ...data, privacy_restricted: !('impression' in data) };
}

export function getRichMenuInsightSummary(
  richMenuId: string,
  from: string,
  to: string,
): Promise<Record<string, unknown>> {
  return getRichMenuInsight(richMenuId, 'summary', from, to);
}

export function getRichMenuInsightDaily(
  richMenuId: string,
  from: string,
  to: string,
): Promise<Record<string, unknown>> {
  return getRichMenuInsight(richMenuId, 'daily', from, to);
}

export async function getDefaultLineRichMenu(): Promise<string | null> {
  const res = await fetch(`${LINE_API_BASE}/user/all/richmenu`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  // § ไม่มี default = 404 — ไม่ใช่ error
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError('/user/all/richmenu', res.status, detail.slice(0, 500));
  }
  const data = await res.json();
  return typeof data?.richMenuId === 'string' ? data.richMenuId : null;
}

export async function cancelDefaultLineRichMenu(): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/user/all/richmenu`, {
    method: 'DELETE',
    headers: getHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return;
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError('/user/all/richmenu', res.status, detail.slice(0, 500));
  }
}

export async function createAliasOnLine(aliasId: string, lineRichMenuId: string): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/richmenu/alias`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ richMenuAliasId: aliasId, richMenuId: lineRichMenuId }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError('/richmenu/alias', res.status, detail.slice(0, 500));
  }
}

export async function getAliasOnLine(aliasId: string): Promise<{ richMenuId: string } | null> {
  const res = await fetch(`${LINE_API_BASE}/richmenu/alias/${encodeURIComponent(aliasId)}`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError(`/richmenu/alias/${aliasId}`, res.status, detail.slice(0, 500));
  }
  const data = await res.json();
  return typeof data?.richMenuId === 'string' ? { richMenuId: data.richMenuId } : null;
}

export async function updateAliasOnLine(aliasId: string, lineRichMenuId: string): Promise<void> {
  // § POST สร้างใหม่อย่างเดียว (มีแล้วได้ 4xx) ย้ายเป้าต้อง PUT — ชื่อ alias เปลี่ยนไม่ได้
  const res = await fetch(`${LINE_API_BASE}/richmenu/alias/${encodeURIComponent(aliasId)}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ richMenuId: lineRichMenuId }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError(`/richmenu/alias/${aliasId}`, res.status, detail.slice(0, 500));
  }
}

export async function deleteAliasOnLine(aliasId: string): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/richmenu/alias/${encodeURIComponent(aliasId)}`, {
    method: 'DELETE',
    headers: getHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  // § ลบซ้ำ = สำเร็จแบบ idempotent
  if (res.status === 404) return;
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LineApiError(`/richmenu/alias/${aliasId}`, res.status, detail.slice(0, 500));
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

/** ผูกริชเมนูให้ผู้ใช้รายคน — error เป็น LineApiError (caller แปลงเป็นข้อความไทยเอง) */
export async function linkUserRichMenu(rawLineUserId: string, lineRichMenuId: string): Promise<void> {
  const endpoint = `/user/{id}/richmenu/${lineRichMenuId}`;
  await withLineCircuit(endpoint, async () => {
    const res = await fetch(
      `${LINE_API_BASE}/user/${encodeURIComponent(rawLineUserId)}/richmenu/${encodeURIComponent(lineRichMenuId)}`,
      {
        method: 'POST',
        headers: getHeaders(),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new LineApiError(endpoint, res.status, detail.slice(0, 500));
    }
  });
}

/** ปลดริชเมนูเฉพาะบุคคล (กลับไปใช้ default) — 404 = ไม่มี link อยู่แล้ว ไม่ใช่ error */
export async function unlinkUserRichMenu(rawLineUserId: string): Promise<void> {
  const endpoint = '/user/{id}/richmenu';
  await withLineCircuit(endpoint, async () => {
    const res = await fetch(`${LINE_API_BASE}/user/${encodeURIComponent(rawLineUserId)}/richmenu`, {
      method: 'DELETE',
      headers: getHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new LineApiError(endpoint, res.status, detail.slice(0, 500));
    }
  });
}

export interface LineMessageQuota {
  type: 'limited' | 'none';
  limit: number | null;
  used: number;
  remaining: number | null;
}

// § แยก circuit breaker key '/message/quota' เพื่อไม่ให้การดึงโควต้าล้มไปเปิดวงจรของ '/message/push'
export async function getLineMessageQuota(): Promise<LineMessageQuota> {
  const endpoint = '/message/quota';
  return withLineCircuit(endpoint, async () => {
    const [quotaRes, usageRes] = await Promise.all([
      fetch(`${LINE_API_BASE}/message/quota`, {
        headers: getHeaders(),
        signal: AbortSignal.timeout(5_000),
      }),
      fetch(`${LINE_API_BASE}/message/quota/consumption`, {
        headers: getHeaders(),
        signal: AbortSignal.timeout(5_000),
      }),
    ]);

    if (!quotaRes.ok) {
      const detail = await quotaRes.text().catch(() => '');
      throw new LineApiError('/message/quota', quotaRes.status, detail.slice(0, 500));
    }
    if (!usageRes.ok) {
      const detail = await usageRes.text().catch(() => '');
      throw new LineApiError('/message/quota/consumption', usageRes.status, detail.slice(0, 500));
    }

    const quotaBody = (await quotaRes.json()) as { type?: unknown; value?: unknown };
    const usageBody = (await usageRes.json()) as { totalUsage?: unknown };

    const rawUsed = Number(usageBody?.totalUsage ?? 0);
    const used = Number.isFinite(rawUsed) && rawUsed >= 0 ? Math.trunc(rawUsed) : 0;

    if (quotaBody?.type === 'limited') {
      const rawLimit = Number(quotaBody?.value ?? 0);
      const limit = Number.isFinite(rawLimit) && rawLimit >= 0 ? Math.trunc(rawLimit) : 0;
      const remaining = Math.max(0, limit - used);
      return {
        type: 'limited',
        limit,
        used,
        remaining,
      };
    }

    return {
      type: 'none',
      limit: null,
      used,
      remaining: null,
    };
  });
}
