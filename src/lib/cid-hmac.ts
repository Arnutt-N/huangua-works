import { createHmac } from 'node:crypto';

/**
 * CID HMAC — HMAC-SHA256 สำหรับ deduplication และ identifier
 * ป้องกันการแจ้งเรื่องซ้ำซ้อนภายใน 7 วัน (sliding window)
 * Input: CID (13 หลัก) + title + description
 * Output: HMAC-SHA256 hex (64 chars)
 */

const HMAC_KEY = process.env.CID_HMAC_KEY || '';

// Build time: ข้าม validation (ไม่มี secret จริง)
// Runtime: scripts/verify-env.ts จะ fail fast ถ้าไม่มี
if (
  process.env.NODE_ENV === 'production' &&
  typeof window === 'undefined' &&
  (!HMAC_KEY || HMAC_KEY.length < 32)
) {
  console.warn('[cid-hmac] CID_HMAC_KEY not configured — dedup will use empty key');
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
