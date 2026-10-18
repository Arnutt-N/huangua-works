import { createHash, createHmac, hkdfSync, createCipheriv, createDecipheriv } from 'node:crypto';

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
  const iv = createHash('sha256').update(`iv:${rawLineUserId}`, 'utf8').digest().subarray(0, 12);
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
