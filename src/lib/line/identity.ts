import { createHmac, hkdfSync, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { lineUsers } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { generateId } from '@/lib/id';
import type { DbOrTx } from '@/lib/db';

// § เจ้าของ pseudonym ของ LINE id ตัวเดียวใน repo — ที่อื่นห้ามสร้าง hash/enc เอง
// hash ใช้ lookup แบบ deterministic, enc เก็บ raw ไว้ถอดกลับตอนส่งออก boundary เท่านั้น
// key แยกจาก CID_HMAC_KEY เสมอ (decision ล็อกใน PRD T5)

export const LINE_ID_HASH_VERSION = 1;
const MIN_KEY_LENGTH = 32;
const ENC_KEY_INFO = 'line-id-enc-v1';

function currentKey(): string {
  return process.env.LINE_ID_HMAC_KEY || '';
}

// § key หายตอน production ต้อง throw ห้าม fallback เป็น hash เปลือยแบบเงียบ
// (pattern เดียวกับ assertKeyUsable ใน cid-hmac.ts)
export function assertLineIdKeyUsable(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (currentKey().length >= MIN_KEY_LENGTH) return;
  throw new Error(
    `[line-identity] LINE_ID_HMAC_KEY missing or shorter than ${MIN_KEY_LENGTH} chars — refusing to pseudonymize LINE id with a guessable key`,
  );
}

export interface LineIdentityPseudonym {
  hash: string;
  enc: string;
  v: number;
}

function encKey(): Buffer {
  return Buffer.from(hkdfSync('sha256', Buffer.from(currentKey(), 'utf8'), Buffer.alloc(0), ENC_KEY_INFO, 32));
}

export function pseudonymizeLineId(rawLineUserId: string): LineIdentityPseudonym {
  assertLineIdKeyUsable();
  const hash = createHmac('sha256', currentKey()).update(rawLineUserId, 'utf8').digest('hex');
  // § GCM ห้ามใช้ nonce ซ้ำ — สุ่ม IV ใหม่ทุกครั้ง รูปแบบ enc (iv||tag||body) รองรับอยู่แล้ว
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv);
  const encBody = Buffer.concat([cipher.update(rawLineUserId, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    hash,
    enc: Buffer.concat([iv, tag, encBody]).toString('base64'),
    v: LINE_ID_HASH_VERSION,
  };
}

export function lookupHash(rawLineUserId: string): string {
  assertLineIdKeyUsable();
  return createHmac('sha256', currentKey()).update(rawLineUserId, 'utf8').digest('hex');
}

export function decryptLineId(enc: string): string {
  assertLineIdKeyUsable();
  const buf = Buffer.from(enc, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const body = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

/** lookup ผู้ใช้ LINE จาก raw id ผ่าน hash */
export async function findLineUserByRaw(db: DbOrTx, rawLineUserId: string) {
  const hash = lookupHash(rawLineUserId);
  return firstOrUndefined(
    db.select().from(lineUsers).where(eq(lineUsers.lineUserIdHash, hash)).limit(1),
  );
}

/**
 * § upsert identity แบบเดียวสำหรับ ingress และ engine — ทุก raw id ต้องผ่าน helper นี้
 * (ถ้า engine สร้างเองจาก payload ที่เป็น hash จะได้ hash-of-hash และส่งออกไม่ได้)
 * ON CONFLICT แล้วอ่านแถวผู้ชนะ กัน race follow+message/redelivery
 */
export async function ensureLineUser(db: DbOrTx, rawLineUserId: string) {
  const existing = await findLineUserByRaw(db, rawLineUserId);
  if (existing) return existing;

  const p = pseudonymizeLineId(rawLineUserId);
  // § ใช้แถวจาก RETURNING ก่อน — ไม่บังคับ read-back รอบสอง (transaction/mock ที่อ่านทันที
  //   อาจยังไม่เห็นแถวใหม่) ถ้า conflict กับคนอื่นค่อยอ่านแถวที่ชนะจริง
  const inserted = await db.insert(lineUsers).values({
    id: generateId(),
    lineUserIdHash: p.hash,
    lineUserIdEnc: p.enc,
    lineUserIdHashV: p.v,
  }).onConflictDoNothing({ target: lineUsers.lineUserIdHash }).returning();
  if (inserted[0]) return inserted[0];
  const winner = await findLineUserByRaw(db, rawLineUserId);
  if (!winner) throw new Error('[line-identity] upsert failed');
  return winner;
}

/** ถอด raw LINE id จาก enc — เรียกเฉพาะตอนส่งออก boundary (push/multicast/getProfile) */
export async function resolveRawLineId(db: DbOrTx, lineUserPk: string): Promise<string | null> {
  const row = await firstOrUndefined(
    db
      .select({ enc: lineUsers.lineUserIdEnc })
      .from(lineUsers)
      .where(eq(lineUsers.id, lineUserPk))
      .limit(1),
  );
  if (!row?.enc) return null;
  try {
    return decryptLineId(row.enc);
  } catch {
    return null;
  }
}
