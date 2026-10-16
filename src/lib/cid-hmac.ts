import { createHmac } from 'node:crypto';

/**
 * CID HMAC — HMAC-SHA256 สำหรับ deduplication และ identifier
 * ป้องกันการแจ้งเรื่องซ้ำซ้อนภายใน 7 วัน (sliding window)
 * Input: CID (13 หลัก) + title + description
 * Output: HMAC-SHA256 hex (64 chars)
 */

const MIN_KEY_LENGTH = 32;

// § อ่าน key สดทุกครั้ง ไม่ผูกค่าไว้ตอน import — assert กับ hash ใช้แหล่งเดียวกันในจังหวะเดียวกันเสมอ
// และโค้ดที่ตั้ง env หลัง import (scripts, test ที่ stubEnv) ได้ key ที่ถูก
// (production ที่ key ว่าง/สั้น assertKeyUsable throw ก่อน hash เสมอ)
function currentHmacKey(): string {
  return process.env.CID_HMAC_KEY || '';
}

// Build time: ข้าม validation (ไม่มี secret จริง)
// Runtime: scripts/verify-env.ts จะ fail fast ถ้าไม่มี
if (
  process.env.NODE_ENV === 'production' &&
  typeof window === 'undefined' &&
  (!currentHmacKey() || currentHmacKey().length < MIN_KEY_LENGTH)
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
  if (currentHmacKey().length >= MIN_KEY_LENGTH) return;
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
  return createHmac('sha256', currentHmacKey()).update(cid, 'utf8').digest('hex').slice(0, 16);
}

/**
 * § normalize dedup payload — ยุบ whitespace กลางด้วย: เดิม lower+trim ปลายอย่างเดียว
 * ช่องว่างกลาง/ขึ้นบรรทัดใหม่หลบ dedup ได้
 */
export function normalizeDedupPayload(cid: string, title: string, description: string): string {
  // § normalize ราย field (ไม่ใช่ทั้งก้อน): trim+ยุบ whitespace กลางทีละช่อง
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return `${norm(cid)}|${norm(title)}|${norm(description)}`;
}

/**
 * § normalize รุ่นเก่า (lower+trim ปลายอย่างเดียว) — เก็บไว้เทียบ hash เก่าใน DB
 * ช่วงเปลี่ยนผ่าน 7 วัน (เท่า DEDUP_WINDOW_DAYS) กันเรื่องซ้ำหลุดตอน hash เปลี่ยนรูป
 */
export function legacyDedupPayload(cid: string, title: string, description: string): string {
  return `${cid}|${title}|${description}`.toLowerCase().trim();
}

/** hash ด้วยสูตรเก่า — ใช้แค่ตอนอ่านเทียบ ไม่ใช้ตอนเขียน */
export function generateLegacyDedupHash(cid: string, title: string, description: string): string {
  assertKeyUsable();
  return createHmac('sha256', currentHmacKey()).update(legacyDedupPayload(cid, title, description), 'utf8').digest('hex');
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
  const payload = normalizeDedupPayload(cid, title, description);
  return createHmac('sha256', currentHmacKey()).update(payload, 'utf8').digest('hex');
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
