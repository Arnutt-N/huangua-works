import { createHash } from 'node:crypto';
import { eq, and, sql, inArray, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { chatBroadcasts, chatBroadcastFailedRecipients, lineUsers } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { broadcastMessage, getFollowerIds, multicast, LineApiError } from './client';
import { LineCircuitOpenError } from './circuit-breaker';
import { parseBroadcastTarget, type BroadcastTarget } from './broadcast-target';
import { decryptLineId } from './identity';
import type { LineOutgoingMessage } from './types';

// § retry ระดับชุด (batch) — multicast ล้มเป็น all-or-nothing ต่อคำขอ (400/409/429)
// จึงนับผู้รับตามชุดที่สำเร็จ/ล้ม ไม่ใช่รายคน ล้ม retry สูงสุด 3 ครั้งต่อชุด
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
// § เพดาน LINE multicast — สูงสุด 500 user id ต่อคำขอ
export const MULTICAST_BATCH_SIZE = 500;
// § แถวค้างสถานะ sending นานกว่านี้ถือว่า process ตายกลางทาง — cron tick ถัดไป requeue เป็น scheduled
export const STALE_SENDING_MS = 30 * 60 * 1000;

const RETRY_KEY_NAMESPACE = 'huangua-line-broadcast';
const RETRY_KEY_ALL_MARKER = 'all';

/**
 * retry key ต่อ (broadcastId, ชุดผู้รับ) — ใช้ SHA-1 แล้วเซ็ต v5 version/variant ให้เป็น UUID v5
 * § LINE ใช้ key ซ้ำเพื่อ dedup เฉพาะคำขอที่ผู้รับเหมือนกัน การเรียง raw id ก่อน hash ทำให้ลำดับผล query ไม่ส่งผลต่อ key
 *    ชุดผู้รับต่างกัน (หรือ replay ที่ผล query เปลี่ยน) ได้คนละ key จึงไม่ข้ามผู้รับไปโดยเงียบ
 */
export function broadcastRetryKey(broadcastId: string, rawIds: readonly string[]): string {
  const material = `${RETRY_KEY_NAMESPACE}:${broadcastId}:${[...rawIds].sort().join(',')}`;
  const bytes = createHash('sha1')
    .update(material)
    .digest();
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * § retry เฉพาะ error ชั่วคราว: 429/5xx, timeout, fetch ตัด (TypeError)
 * 429 เป็นการฝ่ากฎ LINE ที่แนะนำให้ backoff ตาม Retry-After — ที่นี่ retry ทันที 1s/2s เพื่อให้ broadcast เสร็จในรอบ cron
 * permanent 4xx อื่น, circuit open, Error ทั่วไป → ไม่ retry (retry ซ้ำก็จะล้มเหมือนเดิมและเปลืองโควต้า)
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof LineApiError) return error.status === 429 || error.status >= 500;
  if (error instanceof LineCircuitOpenError) return false;
  if (error instanceof DOMException && error.name === 'TimeoutError') return true;
  if (error instanceof TypeError) return true;
  return false;
}

async function sendWithRetry(retryKey: string, send: (retryKey: string) => Promise<void>): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await send(retryKey);
      return;
    } catch (err) {
      lastError = err;
      if (!isTransientError(err) || attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
  throw lastError;
}

/** requeue แถว sending ค้างให้ scheduled ใหม่ — เรียกทุกรอบ cron ก่อนหางาน ส่วน sendBroadcast ไม่แตะ stale อีก */
export async function recoverStaleSending(now: Date = new Date()): Promise<number> {
  const db = await getDb();
  const rows = await db
    .update(chatBroadcasts)
    .set({ status: 'scheduled', scheduledAt: now, updatedAt: now })
    .where(
      and(
        eq(chatBroadcasts.status, 'sending'),
        lt(chatBroadcasts.updatedAt, new Date(now.getTime() - STALE_SENDING_MS)),
      ),
    )
    .returning({ id: chatBroadcasts.id });
  return rows.length;
}

export type SendBroadcastOutcome =
  | { kind: 'sent'; totalRecipients: number; successCount: number; failedCount: number }
  | { kind: 'failed'; totalRecipients: number; successCount: number; failedCount: number; error: string }
  | { kind: 'skipped-not-claimable' };

type Db = Awaited<ReturnType<typeof getDb>>;

function recipientHash(rawLineUserId: string): string {
  // § เก็บเฉพาะ hash ของ raw id ในตาราง failed — raw id ห้ามลง DB (สอดคล้อง T5)
  return createHash('sha256').update(rawLineUserId).digest('hex');
}

export async function sendBroadcast(broadcastId: string): Promise<SendBroadcastOutcome> {
  const db = await getDb();

  const updated = await db
    .update(chatBroadcasts)
    .set({ status: 'sending', updatedAt: new Date() })
    .where(and(eq(chatBroadcasts.id, broadcastId), eq(chatBroadcasts.status, 'scheduled')))
    .returning({ id: chatBroadcasts.id, content: chatBroadcasts.content, target: chatBroadcasts.target });

  const row = updated[0];
  if (!row) {
    const [draft] = await db
      .update(chatBroadcasts)
      .set({ status: 'sending', updatedAt: new Date() })
      .where(and(eq(chatBroadcasts.id, broadcastId), eq(chatBroadcasts.status, 'draft')))
      .returning({ id: chatBroadcasts.id, content: chatBroadcasts.content, target: chatBroadcasts.target });
    if (!draft) return { kind: 'skipped-not-claimable' };
    return deliverAndRecord(db, draft.id, draft.content as LineOutgoingMessage[], parseBroadcastTarget(draft.target));
  }

  return deliverAndRecord(db, row.id, row.content as LineOutgoingMessage[], parseBroadcastTarget(row.target));
}

async function deliverAndRecord(
  db: Db,
  id: string,
  messages: LineOutgoingMessage[],
  target: BroadcastTarget,
): Promise<SendBroadcastOutcome> {
  if (target.kind === 'all') return deliverAll(db, id, messages);
  return deliverTargeted(db, id, messages, target.ids);
}

async function markFailed(db: Db, id: string, error: string, counts: { total: number; success: number; failed: number }): Promise<SendBroadcastOutcome> {
  await db
    .update(chatBroadcasts)
    .set({
      status: 'failed',
      errorMessage: error.slice(0, 500),
      totalRecipients: counts.total,
      successCount: counts.success,
      failedCount: counts.failed,
      updatedAt: new Date(),
    })
    .where(eq(chatBroadcasts.id, id));
  return { kind: 'failed', totalRecipients: counts.total, successCount: counts.success, failedCount: counts.failed, error };
}

async function deliverAll(
  db: Db,
  id: string,
  messages: LineOutgoingMessage[],
): Promise<SendBroadcastOutcome> {
  // § path 'all' ไม่มีรายชื่อผู้รับ — ใช้ marker แยกจากชุดผู้รับเพื่อไม่ให้ key ไปทับ targeted
  const retryKey = broadcastRetryKey(id, [RETRY_KEY_ALL_MARKER]);
  let lastError: unknown = null;
  try {
    await sendWithRetry(retryKey, (key) => broadcastMessage(messages, key));
  } catch (err) {
    lastError = err;
  }

  if (lastError !== null) {
    const error = lastError instanceof Error ? lastError.message : 'unknown';
    return markFailed(db, id, error, { total: 0, success: 0, failed: 0 });
  }

  // § path 'all' ไม่มีรายชื่อผู้รับ — total เป็นค่าประมาณจาก follower count ตอนส่งสำเร็จ
  let total = 0;
  try {
    total = (await dryRunBroadcast()).estimatedRecipients;
  } catch {
    total = 0;
  }
  await db
    .update(chatBroadcasts)
    .set({ status: 'sent', sentAt: new Date(), totalRecipients: total, successCount: total, failedCount: 0, updatedAt: new Date() })
    .where(eq(chatBroadcasts.id, id));
  return { kind: 'sent', totalRecipients: total, successCount: total, failedCount: 0 };
}

async function recordFailedRecipients(db: Db, broadcastId: string, rawIds: string[], attempts: number, error: string) {
  for (const rawId of rawIds) {
    await db
      .insert(chatBroadcastFailedRecipients)
      .values({
        id: generateId(),
        broadcastId,
        recipientHash: recipientHash(rawId),
        attempts,
        lastError: error.slice(0, 500),
      })
      .onConflictDoUpdate({
        target: [chatBroadcastFailedRecipients.broadcastId, chatBroadcastFailedRecipients.recipientHash],
        set: { attempts, lastError: error.slice(0, 500), updatedAt: new Date() },
      });
  }
}

async function deliverTargeted(
  db: Db,
  id: string,
  messages: LineOutgoingMessage[],
  internalIds: string[],
): Promise<SendBroadcastOutcome> {
  // raw id มีชีวิตเฉพาะในฟังก์ชันนี้ — ถอดจาก enc เพื่อยิง multicast แล้วทิ้ง ไม่ persist
  const rows = await db
    .select({ lineUserIdEnc: lineUsers.lineUserIdEnc })
    .from(lineUsers)
    .where(inArray(lineUsers.id, internalIds));
  const rawIds: string[] = [];
  for (const r of rows) {
    if (!r.lineUserIdEnc) continue;
    try {
      rawIds.push(decryptLineId(r.lineUserIdEnc));
    } catch {
      continue;
    }
  }
  const total = rawIds.length;

  if (total === 0) {
    return markFailed(db, id, 'ไม่พบผู้รับเป้าหมายในระบบ', { total: 0, success: 0, failed: 0 });
  }

  let success = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (let start = 0; start < rawIds.length; start += MULTICAST_BATCH_SIZE) {
    const batch = rawIds.slice(start, start + MULTICAST_BATCH_SIZE);
    // § key ต่อชุดผู้รับจริง — retry ในชุดใช้ key เดิม (LINE dedup ต่อผู้รับชุดเดียวกัน)
    //   ผล query สลับลำดับไม่เปลี่ยน key แต่ชุดผู้รับเปลี่ยนแล้วต้องคนละ key
    const retryKey = broadcastRetryKey(id, batch);
    let lastError: unknown = null;
    try {
      await sendWithRetry(retryKey, (key) => multicast(batch, messages, key));
    } catch (err) {
      lastError = err;
    }
    if (lastError === null) {
      success += batch.length;
    } else {
      failed += batch.length;
      const error = lastError instanceof Error ? lastError.message : 'unknown';
      firstError ??= error;
      await recordFailedRecipients(db, id, batch, MAX_ATTEMPTS, error);
    }
  }

  if (failed > 0) {
    return markFailed(db, id, firstError ?? 'ส่งบางชุดไม่สำเร็จ', { total, success, failed });
  }

  await db
    .update(chatBroadcasts)
    .set({ status: 'sent', sentAt: new Date(), totalRecipients: total, successCount: success, failedCount: 0, updatedAt: new Date() })
    .where(eq(chatBroadcasts.id, id));
  return { kind: 'sent', totalRecipients: total, successCount: success, failedCount: 0 };
}

/** dry-run: นับผู้รับโดยไม่ส่งจริง — preview ก่อนกดส่ง (targeted นับจาก DB ไม่ยิง LINE) */
export async function dryRunBroadcast(target: BroadcastTarget = { kind: 'all' }): Promise<{ estimatedRecipients: number }> {
  if (target.kind === 'line_user_ids') {
    if (target.ids.length === 0) return { estimatedRecipients: 0 };
    const db = await getDb();
    const rows = await db
      .select({ id: lineUsers.id })
      .from(lineUsers)
      .where(inArray(lineUsers.id, target.ids));
    return { estimatedRecipients: rows.length };
  }
  let count = 0;
  let start: string | undefined;
  for (;;) {
    const page = await getFollowerIds(1000, start);
    count += page.userIds.length;
    if (!page.next) break;
    start = page.next;
  }
  return { estimatedRecipients: count };
}

export async function getDueScheduled(): Promise<{ id: string }[]> {
  const db = await getDb();
  return db
    .select({ id: chatBroadcasts.id })
    .from(chatBroadcasts)
    .where(
      and(
        eq(chatBroadcasts.status, 'scheduled'),
        sql`${chatBroadcasts.scheduledAt} <= NOW()`,
      ),
    )
    .orderBy(chatBroadcasts.scheduledAt)
    .limit(5);
}
