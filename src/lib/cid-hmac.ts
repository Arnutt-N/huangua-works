import { createHmac } from 'node:crypto';

/**
 * CID HMAC — HMAC-SHA256 สำหรับ deduplication และ identifier
 * ป้องกันการแจ้งเรื่องซ้ำซ้อนภายใน 7 วัน (sliding window)
 * Input: CID (13 หลัก) + title + description
 * Output: HMAC-SHA256 hex (64 chars)
 */

const HMAC_KEY = process.env.CID_HMAC_KEY || '';
const MIN_KEY_LENGTH = 32;

// Build time: ข้าม validation (ไม่มี secret จริง)
// Runtime: scripts/verify-env.ts จะ fail fast ถ้าไม่มี
if (
  process.env.NODE_ENV === 'production' &&
  typeof window === 'undefined' &&
  (!HMAC_KEY || HMAC_KEY.length < MIN_KEY_LENGTH)
) {
  console.warn('[cid-hmac] CID_HMAC_KEY not configured — dedup will use empty key');
}

/**
 * § ถ้า key หายไปตอน runtime ต้อง throw ไม่ใช่แค่ warn แล้วเดินต่อด้วย key ว่าง
 *
 * HMAC ที่ key ว่างมีค่าเท่ากับ hash ธรรมดา — CID เป็นเลข 13 หลักที่มี checksum
 * บังคับรูปแบบอยู่แล้ว พื้นที่ค้นหาจึงเล็กพอจะไล่ทั้งหมดได้ ใครได้ hash ไปก็ย้อนกลับ
 * เป็น CID ตัวจริงได้ ซึ่งพังทั้งเหตุผลที่เลือกใช้ HMAC แต่แรก
 *
 * verify-env.ts กันตอน build แล้ว แต่ build-time env กับ runtime env เป็นคนละชุดได้
 * (เช่นตั้งค่าใน Vercel คนละ environment) — ด่านนี้จึงจำเป็น
 * ยอมให้ request พังดังๆ ดีกว่าเขียน identifier ที่ถอดกลับได้ลง DB เงียบๆ
 */
function assertKeyUsable(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (HMAC_KEY.length >= MIN_KEY_LENGTH) return;
  throw new Error(
    `[cid-hmac] CID_HMAC_KEY missing or shorter than ${MIN_KEY_LENGTH} chars — refusing to hash CID with a guessable key`,
  );
}

/**
 * สร้าง HMAC hash ของ CID เพียงอย่างเดียว (16 ตัวแรก)
 * ใช้เป็น identifier แทน plaintext CID ในกรณีที่ citizen ไม่ได้ให้ email
 * (เช่น สร้าง placeholder email `cid-${hash}@placeholder.local`)
 *
 * เป็น HMAC (ไม่ใช่ hash ธรรมดา) เพื่อกัน dictionary attack แม้ค่ารั่วออกไป
 * ใช้ 16 ตัวแรก (64 บิต) เพราะเพียงพอสำหรับความ unique ใน scale ตำบล
 * และไม่เปิดเผย hash เต็มในกรณีที่ identifier ถูก log/แสดง
 *
 * @param cid - เลขบัตรประชาชน 13 หลัก (string)
 * @returns HMAC hex 16 ตัวแรก
 */
export function generateCidHash(cid: string): string {
  assertKeyUsable();
  return createHmac('sha256', HMAC_KEY).update(cid, 'utf8').digest('hex').slice(0, 16);
}

/**
 * สร้าง HMAC hash สำหรับ deduplication
 */
export function generateDedupHash(
  cid: string,
  title: string,
  description: string
): string {
  assertKeyUsable();
  const payload = `${cid}|${title}|${description}`.toLowerCase().trim();
  return createHmac('sha256', HMAC_KEY).update(payload, 'utf8').digest('hex');
}

/**
 * ตรวจสอบว่า hash นี้มีอยู่ในระบบหรือไม่ (ใช้ใน dedup check)
 */
export function verifyDedupHash(
  cid: string,
  title: string,
  description: string,
  expectedHash: string
): boolean {
  const actualHash = generateDedupHash(cid, title, description);
  return actualHash === expectedHash;
}
