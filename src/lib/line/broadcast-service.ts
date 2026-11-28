import { createHash } from 'node:crypto';
import { eq, and, sql, inArray, lt, lte } from 'drizzle-orm';
import { getDb, type DbOrTx } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { chatBroadcasts, chatBroadcastBatches, chatBroadcastFailedRecipients, lineUsers } from '@/lib/db/schema';
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
// § Retry-After นานกว่านี้ไม่ควรครอง cron ไว้ — บันทึก next_attempt แล้วปล่อย lease ให้งานอื่นก่อน
const DEFER_THRESHOLD_MS = 30_000;

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
 * 429 retry ตาม Retry-After ถ้ามี (ดู retryDelayMs) ไม่มีใช้ backoff 1s/2s เพื่อให้ broadcast เสร็จในรอบ cron
 * permanent 4xx อื่น, circuit open, Error ทั่วไป → ไม่ retry (retry ซ้ำก็จะล้มเหมือนเดิมและเปลืองโควต้า)
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof LineApiError) return error.status === 429 || error.status >= 500;
  if (error instanceof LineCircuitOpenError) return false;
  if (error instanceof DOMException && error.name === 'TimeoutError') return true;
  if (error instanceof TypeError) return true;
  return false;
}

function retryDelayMs(error: unknown, attempt: number): number {
  // § 429 ที่ LINE ส่ง Retry-After มาให้เชื่อตามระยะนั้นก่อน backoff คงที่ — retry เร็วเกินไปจะโดนปฏิเสธซ้ำ
  if (error instanceof LineApiError && error.status === 429 && error.retryAfterMs !== undefined) {
    return error.retryAfterMs;
  }
  return RETRY_DELAY_MS * attempt;
}

class BroadcastSendError extends Error {
  constructor(readonly originalError: unknown, readonly attempts: number) {
    super(originalError instanceof Error ? originalError.message : 'unknown');
  }
}

class BroadcastDeferredError extends Error {
  constructor(readonly delayMs: number) {
    super('defer broadcast until Retry-After');
  }
}

async function sendWithRetry(retryKey: string, send: (retryKey: string) => Promise<void>): Promise<void> {
  let lastError: unknown = null;
  let attempts = 0;
  for (attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
    try {
      await send(retryKey);
      return;
    } catch (err) {
      lastError = err;
      if (!isTransientError(err) || attempts === MAX_ATTEMPTS) break;
      const delay = retryDelayMs(err, attempts);
      // § 429 Retry-After ยาว → คืน lease ให้ cron รอบอื่น แทนการนอนครอง worker เดียว
      if (delay > DEFER_THRESHOLD_MS && err instanceof LineApiError && err.status === 429) {
        throw new BroadcastDeferredError(delay);
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new BroadcastSendError(lastError, attempts);
}

/** requeue แถว sending ค้างให้ scheduled ใหม่ — เรียกทุกรอบ cron ก่อนหางาน ส่วน sendBroadcast ไม่แตะ stale อีก */
export async function recoverStaleSending(now: Date = new Date()): Promise<number> {
  const db = await getDb();
  const rows = await db
    .update(chatBroadcasts)
    // § ล้าง leaseOwner ด้วย — worker เก่าต้องหมดสิทธิ์เขียนผลทับ worker ที่รับช่วงต่อ
    .set({ status: 'scheduled', scheduledAt: now, updatedAt: now, leaseOwner: null })
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
  | { kind: 'deferred'; nextAttemptAt: Date }
  | { kind: 'skipped-invalid-target' }
  | { kind: 'skipped-not-claimable' };

type Db = Awaited<ReturnType<typeof getDb>>;
type BatchRow = typeof chatBroadcastBatches.$inferSelect;

function recipientHash(rawLineUserId: string): string {
  // § เก็บเฉพาะ hash ของ raw id ในตาราง failed — raw id ห้ามลง DB (สอดคล้อง T5)
  return createHash('sha256').update(rawLineUserId).digest('hex');
}

export async function sendBroadcast(broadcastId: string): Promise<SendBroadcastOutcome> {
  const db = await getDb();
  const owner = generateId();

  const updated = await db
    .update(chatBroadcasts)
    .set({ status: 'sending', leaseOwner: owner, updatedAt: new Date() })
    .where(and(eq(chatBroadcasts.id, broadcastId), eq(chatBroadcasts.status, 'scheduled')))
    .returning({ id: chatBroadcasts.id, content: chatBroadcasts.content, target: chatBroadcasts.target });

  const row = updated[0];
  if (!row) {
    const [draft] = await db
      .update(chatBroadcasts)
      .set({ status: 'sending', leaseOwner: owner, updatedAt: new Date() })
      .where(and(eq(chatBroadcasts.id, broadcastId), eq(chatBroadcasts.status, 'draft')))
      .returning({ id: chatBroadcasts.id, content: chatBroadcasts.content, target: chatBroadcasts.target });
    if (!draft) return { kind: 'skipped-not-claimable' };
    return deliverAndRecord(db, draft.id, draft.content as LineOutgoingMessage[], parseBroadcastTarget(draft.target), owner);
  }

  return deliverAndRecord(db, row.id, row.content as LineOutgoingMessage[], parseBroadcastTarget(row.target), owner);
}

async function deliverAndRecord(
  db: Db,
  id: string,
  messages: LineOutgoingMessage[],
  target: BroadcastTarget | null,
  owner: string,
): Promise<SendBroadcastOutcome> {
  // § stored target เพี้ยน = อย่าส่งต่อ (มิเช่นนั้น fallback 'all' จะขยายผู้รับทั้งระบบ)
  if (target === null) {
    const outcome = await markFailed(db, id, 'เป้าหมาย broadcast ไม่ถูกต้อง', { total: 0, success: 0, failed: 0 }, owner);
    return outcome.kind === 'skipped-not-claimable' ? outcome : { kind: 'skipped-invalid-target' };
  }
  const batches = await prepareBatches(db, id, target);
  if (target.kind === 'line_user_ids' && batches.length === 0) {
    return markFailed(db, id, 'ไม่พบผู้รับเป้าหมายในระบบ', { total: 0, success: 0, failed: 0 }, owner);
  }
  return deliverPreparedBatches(db, id, messages, owner, batches);
}

async function prepareBatches(db: Db, id: string, target: BroadcastTarget): Promise<BatchRow[]> {
  const existing = await db.select().from(chatBroadcastBatches).where(eq(chatBroadcastBatches.broadcastId, id));
  if (existing.length > 0) return existing.sort((a, b) => a.batchIndex - b.batchIndex);

  // § membership/retry key ถูกตรึงก่อนยิง LINE ครั้งแรก — recovery ใช้แถวเดิม ไม่คำนวณจาก target ปัจจุบัน
  if (target.kind === 'all') {
    await db.insert(chatBroadcastBatches).values({
      id: generateId(),
      broadcastId: id,
      batchIndex: 0,
      recipientIds: null,
      recipientHashes: [RETRY_KEY_ALL_MARKER],
      retryKey: broadcastRetryKey(id, [RETRY_KEY_ALL_MARKER]),
    });
  } else {
    const rows = await db
      .select({ id: lineUsers.id, lineUserIdEnc: lineUsers.lineUserIdEnc })
      .from(lineUsers)
      .where(inArray(lineUsers.id, target.ids));
    const pairs: { internalId: string; rawId: string }[] = [];
    for (const r of rows) {
      if (!r.lineUserIdEnc) continue;
      try { pairs.push({ internalId: r.id, rawId: decryptLineId(r.lineUserIdEnc) }); } catch { /* ข้ามผู้รับที่ถอดรหัสไม่ได้ */ }
    }
    // § ใช้ลำดับ string ปกติให้ตรงกับ broadcastRetryKey (Array#sort) — localeCompare จัดลำดับต่างกัน
    pairs.sort((a, b) => a.rawId < b.rawId ? -1 : a.rawId > b.rawId ? 1 : 0);
    const values = [];
    for (let start = 0, index = 0; start < pairs.length; start += MULTICAST_BATCH_SIZE, index++) {
      const chunk = pairs.slice(start, start + MULTICAST_BATCH_SIZE);
      values.push({
        id: generateId(),
        broadcastId: id,
        batchIndex: index,
        recipientIds: chunk.map((p) => p.internalId),
        recipientHashes: chunk.map((p) => recipientHash(p.rawId)),
        retryKey: broadcastRetryKey(id, chunk.map((p) => p.rawId)),
      });
    }
    if (values.length > 0) await db.insert(chatBroadcastBatches).values(values);
  }

  const rows = await db.select().from(chatBroadcastBatches).where(eq(chatBroadcastBatches.broadcastId, id));
  return rows.sort((a, b) => a.batchIndex - b.batchIndex);
}

async function markFailed(db: DbOrTx, id: string, error: string, counts: { total: number; success: number; failed: number }, owner: string): Promise<SendBroadcastOutcome> {
  // § เขียนผลได้เฉพาะ worker ที่ยังถือ lease — คนที่ถูก requeue แล้วต้องไม่ทับคนที่รับช่วงต่อ
  const rows = await db
    .update(chatBroadcasts)
    .set({
      status: 'failed',
      errorMessage: error.slice(0, 500),
      totalRecipients: counts.total,
      successCount: counts.success,
      failedCount: counts.failed,
      leaseOwner: null,
      updatedAt: new Date(),
    })
    .where(and(eq(chatBroadcasts.id, id), eq(chatBroadcasts.leaseOwner, owner)))
    .returning({ id: chatBroadcasts.id });
  if (rows.length === 0) return { kind: 'skipped-not-claimable' };
  return { kind: 'failed', totalRecipients: counts.total, successCount: counts.success, failedCount: counts.failed, error };
}

async function recordFailedRecipients(db: DbOrTx, broadcastId: string, hashes: string[], attempts: number, error: string) {
  if (hashes.length === 0) return;
  // § upsert เป็น statement เดียว — 500 ผู้รับล้มต้องไม่แปลงเป็น 500 round trip ใน tx เดียว
  await db
    .insert(chatBroadcastFailedRecipients)
    .values(hashes.map((recipientHash) => ({
      id: generateId(),
      broadcastId,
      recipientHash,
      attempts,
      lastError: error.slice(0, 500),
    })))
    .onConflictDoUpdate({
      target: [chatBroadcastFailedRecipients.broadcastId, chatBroadcastFailedRecipients.recipientHash],
      set: { attempts, lastError: error.slice(0, 500), updatedAt: new Date() },
    });
}

async function deliverPreparedBatches(
  db: Db,
  id: string,
  messages: LineOutgoingMessage[],
  owner: string,
  batches: BatchRow[],
): Promise<SendBroadcastOutcome> {
  const now = new Date();
  let firstError: string | null = null;
  const acceptedIds = new Set(batches.filter((b) => b.status === 'accepted').map((b) => b.id));
  const attemptsById = new Map<string, number>();
  // § จำนวนผู้รับที่ส่งจริงต่อชุด — resolve ใหม่ทุกครั้งอาจได้น้อยกว่าที่ตรึงไว้
  //   ห้ามนับ recipientHashes เป็นจำนวนส่ง (ข้อ 9) เก็บที่นี่แล้วใช้เป็น success
  const resolvedCountById = new Map<string, number>();
  const rejected: BatchRow[] = [];

  for (const batch of batches) {
    if (acceptedIds.has(batch.id)) continue;
    if (batch.nextAttemptAt && batch.nextAttemptAt > now) {
      return { kind: 'deferred', nextAttemptAt: batch.nextAttemptAt };
    }

    let result: { ok: true; attempts: number } | { ok: false; error: BroadcastSendError } | { deferred: BroadcastDeferredError };
    try {
      if (batch.recipientIds === null) {
        await sendWithRetry(batch.retryKey, (key) => broadcastMessage(messages, key));
        resolvedCountById.set(batch.id, 0); // path 'all' ไม่มีรายชื่อ — นับจาก dry-run ตอนท้าย
      } else {
        const rows = await db
          .select({ id: lineUsers.id, lineUserIdEnc: lineUsers.lineUserIdEnc })
          .from(lineUsers)
          .where(inArray(lineUsers.id, batch.recipientIds));
        // § ใช้ลำดับ PK ที่ตรึงไว้ตอนเตรียมชุด — ผล query ตอนส่งอาจสลับลำดับได้
        const rawByPk = new Map<string, string>();
        for (const r of rows) {
          if (r.lineUserIdEnc) {
            try { rawByPk.set(r.id, decryptLineId(r.lineUserIdEnc)); } catch { /* ข้าม */ }
          }
        }
        const rawIds = batch.recipientIds
          .map((pk) => rawByPk.get(pk))
          .filter((v): v is string => v !== undefined);
        await sendWithRetry(batch.retryKey, (key) => multicast(rawIds, messages, key));
        resolvedCountById.set(batch.id, rawIds.length);
      }
      result = { ok: true, attempts: 1 };
    } catch (err) {
      if (err instanceof BroadcastDeferredError) {
        result = { deferred: err };
      } else if (err instanceof BroadcastSendError) {
        result = { ok: false, error: err };
      } else {
        result = { ok: false, error: new BroadcastSendError(err, 1) };
      }
    }

    if ('deferred' in result) {
      const nextAttemptAt = new Date(Date.now() + result.deferred.delayMs);
      // § เขียนกำหนด retry ของ batch + คืน lease ของ broadcast ใน transaction เดียว —
      //   เดิมแยกสองคำสั่ง worker หยุดตรงกลางทำให้ batch ถย้ายวันแต่ broadcast ยัง sending
      //   แล้วรอบกู้คืนจะ claim ทับก่อน nextAttemptAt จนกว่าจะเก่า (ข้อ 8)
      await db.transaction(async (tx) => {
        await tx.update(chatBroadcastBatches).set({ attempts: 1, nextAttemptAt, lastError: result.deferred.message, updatedAt: new Date() })
          .where(eq(chatBroadcastBatches.id, batch.id));
        await tx.update(chatBroadcasts).set({ status: 'scheduled', scheduledAt: nextAttemptAt, leaseOwner: null, updatedAt: new Date() })
          .where(and(eq(chatBroadcasts.id, id), eq(chatBroadcasts.leaseOwner, owner)));
      });
      return { kind: 'deferred', nextAttemptAt };
    }

    if (result.ok) {
      // § checkpoint ทันทีที่ LINE รับ — interrupt หลังจุดนี้ต้องไม่ส่งชุดเดิมซ้ำ
      await db.update(chatBroadcastBatches).set({ status: 'accepted', attempts: result.attempts, lastError: null, updatedAt: new Date(), nextAttemptAt: null })
        .where(and(eq(chatBroadcastBatches.id, batch.id), eq(chatBroadcastBatches.status, 'pending')));
      acceptedIds.add(batch.id);
      attemptsById.set(batch.id, result.attempts);
      continue;
    }

    const error = result.error.message;
    firstError ??= error;
    await db.update(chatBroadcastBatches).set({ attempts: result.error.attempts, lastError: error.slice(0, 500), updatedAt: new Date() })
      .where(eq(chatBroadcastBatches.id, batch.id));
    attemptsById.set(batch.id, result.error.attempts);
    rejected.push(batch);
  }

  const accepted = batches.filter((b) => acceptedIds.has(b.id));
  let total: number;
  let success: number;
  if (batches[0]?.recipientIds === null) {
    total = 0;
    success = 0;
    if (accepted.length > 0) {
      // § path 'all' ไม่มีรายชื่อผู้รับ — total เป็นค่าประมาณจาก follower count ตอนส่งสำเร็จ
      try { total = (await dryRunBroadcast()).estimatedRecipients; } catch { total = 0; }
      success = total;
    }
  } else {
    // § total = จำนวนที่ตรึงไว้ตอนเตรียมชุด (ผู้รับที่ตั้งใจ) — success = จำนวนที่ resolve
    //   แล้วส่งจริง ส่วนที่หายไปถูกนับเป็น failed ไม่ใช่หายไปจากยอด (ข้อ 9)
    total = batches.reduce((sum, b) => sum + b.recipientHashes.length, 0);
    success = accepted.reduce((sum, b) => sum + (resolvedCountById.get(b.id) ?? 0), 0);
  }
  const failed = Math.max(0, total - success);

  if (rejected.length > 0) {
    // § สถานะ terminal และรายชื่อผู้รับที่ล้มต้องเขียนใน transaction เดียว — insert พังแล้ว broadcast ค้าง failed โดยไม่มีรายละเอียดจะกู้ไม่ได้
    return db.transaction(async (tx) => {
      const outcome = await markFailed(tx, id, firstError ?? 'ส่งบางชุดไม่สำเร็จ', { total, success, failed }, owner);
      // § เขียนเฉพาะผู้ชนะ lease — คนที่ถูก requeue ต้องไม่ทับผลของ worker ใหม่
      if (outcome.kind === 'failed') {
        for (const batch of rejected) {
          await recordFailedRecipients(tx, id, batch.recipientHashes, Math.max(1, attemptsById.get(batch.id) ?? 1), batch.lastError ?? firstError ?? 'unknown');
        }
      }
      return outcome;
    });
  }

  const written = await db
    .update(chatBroadcasts)
    .set({ status: 'sent', sentAt: new Date(), totalRecipients: total, successCount: success, failedCount: 0, leaseOwner: null, updatedAt: new Date() })
    .where(and(eq(chatBroadcasts.id, id), eq(chatBroadcasts.leaseOwner, owner)))
    .returning({ id: chatBroadcasts.id });
  if (written.length === 0) return { kind: 'skipped-not-claimable' };
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
        lte(chatBroadcasts.scheduledAt, sql`NOW()`),
      ),
    )
    .orderBy(chatBroadcasts.scheduledAt)
    .limit(5);
}
