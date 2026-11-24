import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { getDb, type DbOrTx } from '@/lib/db';
import { generateId } from '@/lib/id';
import { createHash } from 'node:crypto';
import { lookupHash, resolveRawLineId } from './identity';
import { lineUsers, lineWebhookEvents } from '@/lib/db/schema';
import type { LineOutgoingMessage, LineWebhookEvent } from './types';

// § dedup key ใช้ webhookEventId เมื่อ LINE ส่งมา (ต่อ delivery) ไม่นั้นใช้ message id
// follow/unfollow/postback ที่ไม่มี id เดียวใช้ hash ของ payload แทน (กัน redelivery)

export type WebhookEventStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface WebhookEventRow {
  id: string;
  dedupKey: string;
  eventType: string;
  lineUserIdHash: string;
  eventTimestamp: number;
  replyToken: string | null;
  payload: LineWebhookEvent;
  status: WebhookEventStatus;
  effectsCommittedAt: Date | null;
  pendingReplies: LineOutgoingMessage[] | null;
  attempts: number;
  leaseUntil: Date | null;
  updatedAt: Date;
}

export function dedupKeyOf(event: LineWebhookEvent): string {
  const messageId = event.type === 'message' ? event.message.id : null;
  const base = event.webhookEventId || messageId;
  if (base) return `w:${base}`;
  return `p:${createHash('sha256').update(JSON.stringify(event)).digest('hex')}`;
}

// § payload ใน DB ต้องไม่มี raw LINE id — แทนที่ source.userId ด้วย HMAC hash เท่านั้น
// ตอน process ถอดกลับจาก line_users.lineUserIdEnc ผ่าน resolveRawLineId (แหล่งเดียวกับ engine)
// (§ ต้องไม่สร้าง enc สำรองใน queue — แต่ละ event อาจมี IV ต่างกันและ DB leak ไม่ควรเปิดเผย raw)
export function sanitizeEvent(event: LineWebhookEvent): LineWebhookEvent {
  const raw = event.source.userId ?? '';
  return {
    ...event,
    source: { ...event.source, userId: raw ? lookupHash(raw) : '' },
  } as LineWebhookEvent;
}

export interface EnqueueResult {
  ok: boolean;
  id?: string;
  error?: unknown;
}

export async function enqueueWebhookEvent(event: LineWebhookEvent): Promise<EnqueueResult> {
  const db = await getDb();
  const payload = sanitizeEvent(event);
  try {
    const [inserted] = await db
      .insert(lineWebhookEvents)
      .values({
        id: generateId(),
        dedupKey: dedupKeyOf(event),
        eventType: event.type,
        lineUserIdHash: lookupHash(event.source.userId),
        eventTimestamp: event.timestamp,
        replyToken: 'replyToken' in event ? event.replyToken : null,
        payload: payload as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing({ target: lineWebhookEvents.dedupKey })
      .returning({ id: lineWebhookEvents.id });
    return { ok: true, id: inserted?.id };
  } catch (error) {
    // § insert พัง = ต้องตอบ 500 ให้ LINE redeliver — ถ้า 200 ข้อความหายเงียบ
    return { ok: false, error };
  }
}

export const CLAIM_LEASE_MS = 60_000;

/** เลือก event ตาม timestamp แล้ว id — ภายใน user เดียวต้อง process ตามลำดับ */
export async function claimNextWebhookEvent(limit = 1): Promise<WebhookEventRow[]> {
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(lineWebhookEvents)
    .where(or(
      eq(lineWebhookEvents.status, 'pending'),
      and(eq(lineWebhookEvents.status, 'processing'), lt(lineWebhookEvents.leaseUntil, now)),
    ))
    .orderBy(asc(lineWebhookEvents.eventTimestamp), asc(lineWebhookEvents.id))
    .limit(limit * 3);
  if (rows.length === 0) return [];

  const claimed: WebhookEventRow[] = [];
  for (const row of rows) {
    // § backoff คำนวณจาก updatedAt (ตอน claim ล่าสุด) — ไม่ต้องพึ่ง Redis ที่อาจหายตอน restart
    // (eventTimestamp ยังเป็นตัวจัดลำดับเสมอ)
    if (row.attempts > 0 && Date.now() - row.updatedAt.getTime() < backoffMsFor(row.attempts)) continue;

    // § กันข้ามลำดับ: ถ้ามี event ก่อนหน้าของ user เดียวกันยังไม่ commit effects ให้รอ
    const earlier = await db
      .select({ id: lineWebhookEvents.id })
      .from(lineWebhookEvents)
      .where(and(
        eq(lineWebhookEvents.lineUserIdHash, row.lineUserIdHash),
        inArray(lineWebhookEvents.status, ['pending', 'processing']),
        lte(lineWebhookEvents.eventTimestamp, row.eventTimestamp),
        sql`${lineWebhookEvents.id} <> ${row.id}`,
        isNull(lineWebhookEvents.effectsCommittedAt),
      ))
      .limit(1);
    if (earlier.length > 0) continue;

    // § claim แบบ condition update — คู่แข่งที่ claim พร้อมกันมีแถวเดียวชนะ
    const leaseUntil = new Date(Date.now() + CLAIM_LEASE_MS);
    const [won] = await db
      .update(lineWebhookEvents)
      .set({ status: 'processing', leaseUntil, attempts: sql`${lineWebhookEvents.attempts} + 1`, updatedAt: now })
      .where(and(
        eq(lineWebhookEvents.id, row.id),
        or(
          eq(lineWebhookEvents.status, 'pending'),
          and(eq(lineWebhookEvents.status, 'processing'), lt(lineWebhookEvents.leaseUntil, now)),
        ),
      ))
      .returning({ id: lineWebhookEvents.id });
    if (!won) continue;
    claimed.push({
      ...(row as WebhookEventRow),
      status: 'processing',
      attempts: row.attempts + 1,
      updatedAt: now,
      leaseUntil,
    });
    if (claimed.length >= limit) break;
  }
  return claimed;
}

/**
 * § effects ต้อง commit พร้อมกันภายใน transaction เดียวกับ lock — ขณะถือ lock ห้ามมี
 * event เก่าของ user เดียวกันที่ effects ยังไม่ commit (เช่น event ที่ process ช้ากว่าแล้วชนะ claim)
 */
export class BarrierDeferred extends Error {}

export async function commitEffects(
  tx: DbOrTx,
  row: WebhookEventRow,
  effects: () => Promise<{ state?: unknown; replies?: LineOutgoingMessage[] }>,
): Promise<{ replies: LineOutgoingMessage[]; state?: unknown } | null> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${row.lineUserIdHash}, 0))`);
  const earlier = await tx
    .select({ id: lineWebhookEvents.id })
    .from(lineWebhookEvents)
    .where(and(
      eq(lineWebhookEvents.lineUserIdHash, row.lineUserIdHash),
      lte(lineWebhookEvents.eventTimestamp, row.eventTimestamp),
      sql`${lineWebhookEvents.id} <> ${row.id}`,
      isNull(lineWebhookEvents.effectsCommittedAt),
      inArray(lineWebhookEvents.status, ['pending', 'processing']),
    ))
    .limit(1);
  if (earlier.length > 0) throw new BarrierDeferred('earlier event for same user not committed');

  const result = await effects();
  const now = new Date();
  await tx
    .update(lineWebhookEvents)
    .set({ effectsCommittedAt: now, pendingReplies: result.replies ?? null, updatedAt: now })
    .where(eq(lineWebhookEvents.id, row.id));
  return { replies: result.replies ?? [], state: result.state };
}

/** § done หลังส่ง reply สำเร็จ — pendingReplies ถูกล้างเพื่อไม่ส่งซ้ำตอน recovery */
export async function markDone(id: string): Promise<void> {
  const db = await getDb();
  await db
    .update(lineWebhookEvents)
    .set({ status: 'done', pendingReplies: null, leaseUntil: null, updatedAt: new Date() })
    .where(eq(lineWebhookEvents.id, id));
}

const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 60_000;

/** § backoff = min(2^attempts,60)s — error/retry คงสถานะ pending ภายใต้ lock เดิมกับ effects */
export function backoffMsFor(attempts: number): number {
  return Math.min(2 ** attempts * 1000, MAX_BACKOFF_MS);
}

/** § error หลัง commit ต้องยังเห็น pendingReplies — เปลี่ยนสถานะอย่างเดียว ห้ามแตะ effects */
export async function markFailed(id: string, attempts: number): Promise<void> {
  const db = await getDb();
  const terminal = attempts >= MAX_ATTEMPTS;
  await db
    .update(lineWebhookEvents)
    .set({
      status: terminal ? 'failed' : 'pending',
      leaseUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(lineWebhookEvents.id, id));
}

/** § payload เก็บ hash แทน raw id — ถอดกลับจาก line_users ที่ engine สร้าง/updating อยู่แล้ว */
export async function restoreEvent(db: DbOrTx, row: WebhookEventRow): Promise<LineWebhookEvent> {
  const payload = { ...row.payload } as LineWebhookEvent;
  const user = await findLineUserByHash(db, row.lineUserIdHash);
  const raw = user ? await resolveRawLineId(db, user.id) : null;
  if (!raw) return payload;
  return {
    ...payload,
    source: { ...payload.source, userId: raw },
  } as LineWebhookEvent;
}

async function findLineUserByHash(db: DbOrTx, hash: string) {
  const rows = await db
    .select({ id: lineUsers.id })
    .from(lineUsers)
    .where(eq(lineUsers.lineUserIdHash, hash))
    .limit(1);
  return rows[0];
}
