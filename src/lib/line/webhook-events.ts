import { aliasedTable, and, asc, eq, inArray, isNull, lt, notExists, or, sql } from 'drizzle-orm';
import { getDb, type DbOrTx } from '@/lib/db';
import { generateId } from '@/lib/id';
import { createHash } from 'node:crypto';
import { ensureLineUser, lookupHash, resolveRawLineId } from './identity';
import { lineUsers, lineWebhookEvents } from '@/lib/db/schema';
import type { LineOutgoingMessage, LineWebhookEvent } from './types';

// § dedup key ใช้ webhookEventId เมื่อ LINE ส่งมา (ต่อ delivery) ไม่นั้นใช้ message id
// follow/unfollow/postback ที่ไม่มี id เดียวใช้ hash ของ payload แทน (กัน redelivery)

export type WebhookEventStatus = 'pending' | 'processing' | 'done' | 'failed';
export type ReplyState = 'pending' | 'none' | 'expired';

// § หลัง done/failed terminal ไม่เก็บ payload ซ้ำ — ใช้โครงสร้างเดิมเพื่อให้ row อ่านแล้วไม่ parse พัง
const CLEARED_PAYLOAD = { type: 'unfollow', timestamp: 0, source: { type: 'user', userId: '' } } as unknown as Record<string, unknown>;

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
  replyState: ReplyState;
  attempts: number;
  leaseUntil: Date | null;
  leaseOwner: string | null;
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
  // § สร้าง identity ก่อน acknowledge — ถ้า worker รีสตาร์ทก่อน process ก็ยังถอด raw id กลับได้
  await ensureLineUser(db, event.source.userId);
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

/**
 * § กฎ predecessor เดียวสำหรับ claim และ commitEffects — เปรียบเทียบ (timestamp,id) แบบเข้มงวด
 *   timestamp เท่ากันต้องตัดด้วย id เสมอ ไม่นั้นสองแถวเวลาเดียวกันจะมองกันว่าเป็น predecessor
 *   current เป็น column ref (claim) หรือค่า row (commitEffects) — ทั้งคู่แทรกผ่าน sql template เดียวกัน
 */
function predecessorFilter(
  other: typeof lineWebhookEvents,
  current: { id: unknown; lineUserIdHash: unknown; eventTimestamp: unknown },
) {
  return and(
    eq(other.lineUserIdHash, current.lineUserIdHash as never),
    sql`${other.id} <> ${current.id}`,
    inArray(other.status, ['pending', 'processing']),
    isNull(other.effectsCommittedAt),
    or(
      lt(other.eventTimestamp, current.eventTimestamp as never),
      and(eq(other.eventTimestamp, current.eventTimestamp as never), sql`${other.id} < ${current.id}`),
    ),
  );
}

/** เลือก event ตาม timestamp แล้ว id — ภายใน user เดียวต้อง process ตามลำดับ */
export async function claimNextWebhookEvent(limit = 1): Promise<WebhookEventRow[]> {
  const db = await getDb();
  const now = new Date();
  const e = aliasedTable(lineWebhookEvents, 'e');
  const p = aliasedTable(lineWebhookEvents, 'p');
  // § กรอง eligibility + predecessor ใน SQL ก่อน loop/claim — แถวที่ถูกบล็อกห้ามบัง event
  //   ของ user อื่นที่พร้อมแล้ว (ต้องไม่ limit ก่อนกรอง)
  const candidates = await db
    .select()
    .from(e)
    .where(and(
      or(
        eq(e.status, 'pending'),
        and(eq(e.status, 'processing'), lt(e.leaseUntil, now)),
      ),
      notExists(db.select({ one: sql`1` }).from(p).where(predecessorFilter(p, {
        id: sql`${e.id}`,
        lineUserIdHash: e.lineUserIdHash,
        eventTimestamp: e.eventTimestamp,
      }))),
    ))
    .orderBy(asc(e.eventTimestamp), asc(e.id));
  if (candidates.length === 0) return [];

  const claimed: WebhookEventRow[] = [];
  for (const row of candidates) {
    // § backoff คำนวณจาก updatedAt (ตอน claim ล่าสุด) — ไม่ต้องพึ่ง Redis ที่อาจหายตอน restart
    if (row.attempts > 0 && now.getTime() - row.updatedAt.getTime() < backoffMsFor(row.attempts)) continue;

    // § claim แบบ condition update — คู่แข่งที่ claim พร้อมกันมีแถวเดียวชนะ
    const leaseUntil = new Date(Date.now() + CLAIM_LEASE_MS);
    // § token ประจำ claim — worker เก่าที่ lease หมดแล้วห้ามมา markDone/renew ของ claim ใหม่
    const owner = generateId();
    const [won] = await db
      .update(lineWebhookEvents)
      .set({
        status: 'processing',
        leaseUntil,
        leaseOwner: owner,
        attempts: sql`${lineWebhookEvents.attempts} + 1`,
        updatedAt: now,
      })
      .where(and(
        eq(lineWebhookEvents.id, row.id),
        or(
          eq(lineWebhookEvents.status, 'pending'),
          and(eq(lineWebhookEvents.status, 'processing'), lt(lineWebhookEvents.leaseUntil, now)),
        ),
      ))
      .returning();
    if (!won) continue;
    claimed.push({
      ...(won as WebhookEventRow),
      attempts: row.attempts + 1,
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

  // § ได้ lock แล้วต้องอ่านแถวเดิมอีกครั้ง — claim เก่าอาจ commit effects ไปแล้วก่อนเราได้ lock
  // (row ใน memory ตอน claim เป็น snapshot) ถ้า commit แล้วข้าม effects ทันที ไม่สร้างซ้ำ
  const [fresh] = await tx
    .select({ effectsCommittedAt: lineWebhookEvents.effectsCommittedAt })
    .from(lineWebhookEvents)
    .where(eq(lineWebhookEvents.id, row.id))
    .limit(1);
  if (fresh?.effectsCommittedAt) return { replies: [], state: undefined };

  const p = aliasedTable(lineWebhookEvents, 'p');
  const earlier = await tx
    .select({ id: p.id })
    .from(p)
    .where(predecessorFilter(p, row))
    .limit(1);
  if (earlier.length > 0) throw new BarrierDeferred('earlier event for same user not committed');

  const result = await effects();
  const now = new Date();
  const replies = result.replies ?? [];
  // § แยก effects กับการส่ง reply — [] แปลว่าไม่มี reply ที่ต้องส่ง (ไม่ใช่งานค้างให้ cron รี retry)
  await tx
    .update(lineWebhookEvents)
    .set({
      effectsCommittedAt: now,
      pendingReplies: replies.length > 0 ? replies : null,
      replyState: replies.length > 0 ? 'pending' : 'none',
      updatedAt: now,
    })
    .where(eq(lineWebhookEvents.id, row.id));
  return { replies, state: result.state };
}

/** § ปิด event เฉพาะ owner ของ claim ปัจจุบัน — worker เก่าที่ lease หมดต้องไม่ทับ */
/** § reply_state กำหนดว่ามี reply ให้ส่งหรือไม่ — 'none' ปิดงานโดยไม่ยิง transport */
export async function markDone(id: string, owner: string, replyState: ReplyState = 'none'): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(lineWebhookEvents)
    .set({
      status: 'done',
      pendingReplies: null,
      replyState,
      // § หลังตอบแล้วไม่ต้องเก็บข้อความ/token ซ้ำ — คง dedupKey กับ timestamp ไว้กัน redelivery
      payload: CLEARED_PAYLOAD,
      replyToken: null,
      leaseUntil: null,
      leaseOwner: null,
      updatedAt: new Date(),
    })
    .where(and(eq(lineWebhookEvents.id, id), eq(lineWebhookEvents.leaseOwner, owner)))
    .returning({ id: lineWebhookEvents.id });
  return rows.length > 0;
}

/** § ต่ออายุ lease เฉพาะ owner เดิม — ใช้ก่อน 작업ที่อาจนานกว่าหน้าต่าง claim */
export async function renewLease(id: string, owner: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(lineWebhookEvents)
    .set({ leaseUntil: new Date(Date.now() + CLAIM_LEASE_MS), updatedAt: new Date() })
    .where(and(
      eq(lineWebhookEvents.id, id),
      eq(lineWebhookEvents.leaseOwner, owner),
      eq(lineWebhookEvents.status, 'processing'),
    ))
    .returning({ id: lineWebhookEvents.id });
  return rows.length > 0;
}

const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 60_000;

/** § backoff = min(2^attempts,60)s — error/retry คงสถานะ pending ภายใต้ lock เดิมกับ effects */
export function backoffMsFor(attempts: number): number {
  return Math.min(2 ** attempts * 1000, MAX_BACKOFF_MS);
}

/** § error หลัง commit ต้องยังเห็น pendingReplies — เปลี่ยนสถานะอย่างเดียว ห้ามแตะ effects */
/** § owner บังคับ — worker ที่ lease หมดแล้วห้ามเปลี่ยนสถานะของแถวที่คนอื่นรับช่วงไปแล้ว */
export async function markFailed(id: string, attempts: number, owner: string): Promise<boolean> {
  const db = await getDb();
  const terminal = attempts >= MAX_ATTEMPTS;
  const rows = await db
    .update(lineWebhookEvents)
    .set({
      status: terminal ? 'failed' : 'pending',
      // § failed เป็น terminal — ล้าง payload/token เหมือน done, คง dedupKey กัน redelivery
      ...(terminal ? { payload: CLEARED_PAYLOAD, replyToken: null, pendingReplies: null, replyState: 'expired' as const } : {}),
      leaseUntil: null,
      leaseOwner: null,
      updatedAt: new Date(),
    })
    .where(and(eq(lineWebhookEvents.id, id), eq(lineWebhookEvents.leaseOwner, owner)))
    .returning({ id: lineWebhookEvents.id });
  return rows.length > 0;
}

/** § หมดอายุ reply token หรือส่งไม่ได้ถาวร → terminal ไม่ให้ cron รี retry token เดิมไม่จบ */
export async function expireReply(id: string, owner: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(lineWebhookEvents)
    .set({
      status: 'failed',
      replyState: 'expired',
      pendingReplies: null,
      payload: CLEARED_PAYLOAD,
      replyToken: null,
      leaseUntil: null,
      leaseOwner: null,
      updatedAt: new Date(),
    })
    .where(and(eq(lineWebhookEvents.id, id), eq(lineWebhookEvents.leaseOwner, owner)))
    .returning({ id: lineWebhookEvents.id });
  return rows.length > 0;
}

/** § ถอด raw ไม่ได้ต้อง fail ชัดเจน — การคืน payload ที่ source.userId เป็น hash ทำให้ engine สร้าง hash-of-hash */
export class MissingLineIdentity extends Error {}

/** § payload เก็บ hash แทน raw id — ถอดกลับจาก canonical line_users ที่ ingress สร้างไว้ */
export async function restoreEvent(db: DbOrTx, row: WebhookEventRow): Promise<LineWebhookEvent> {
  const payload = { ...row.payload } as LineWebhookEvent;
  const user = await findLineUserByHash(db, row.lineUserIdHash);
  const raw = user ? await resolveRawLineId(db, user.id) : null;
  if (!raw) throw new MissingLineIdentity(`cannot restore LINE identity for event ${row.id}`);
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
