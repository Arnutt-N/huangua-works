import { createHmac } from 'node:crypto';

/**
 * CID HMAC — HMAC-SHA256 สำหรับ deduplication
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
