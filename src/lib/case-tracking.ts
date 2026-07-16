import { randomInt } from 'node:crypto';

/**
 * Tracking Code — เลขติดตามสำหรับ citizen (คล้าย EMS ไปรษณีย์ไทย)
 *
 * รูปแบบ: `HN` + 9 หลักสุ่ม (เช่น `HN483729156`)
 *   - `HN` = Hua Ngua (หัวงัว)
 *   - 9 หลักสุ่มจาก crypto.randomInt → entropy ≈ 30 บิต (10^9 ค่า)
 *   - ผสมกับ rate limit 10 ครั้ง/5 นาที → brute force ไม่ได้ในทางปฏิบัติ
 *
 * lookup ผ่าน GET /api/cases/[id] ใช้ trackingCode แทน UUID PK
 * เพื่อไม่เปิดเผย UUID v7 ที่ timestamp-ordered และเดาได้
 */

const PREFIX = 'HN';
const DIGITS = 9;
const MAX_VALUE = 10 ** DIGITS; // 1_000_000_000
const CODE_LENGTH = PREFIX.length + DIGITS; // 11

/**
 * สุ่ม tracking code รูปแบบ `HN` + 9 หลัก
 * หลักนำหน้าเติม 0 ให้ครบ 9 หลักเสมอ (เช่น HN000000001)
 */
export function generateTrackingCode(): string {
  const num = randomInt(0, MAX_VALUE);
  return PREFIX + num.toString().padStart(DIGITS, '0');
}

/**
 * Normalize input ที่ citizen กรอก (รับได้ทั้งมี/ไม่มีเว้นวรรค, ตัวเล็ก/ใหญ่)
 * @returns รูปแบบมาตรฐาน `HNxxxxxxxxx` หรือ null ถ้า format ผิด
 *
 * ผู้เรียกควร return 404 ไม่ใช่ 400 เมื่อได้ null เพื่อไม่เปิดเผยว่า format ผิด (กัน enumeration)
 */
export function normalizeTrackingCode(input: string): string | null {
  const cleaned = input.replace(/[\s-]/g, '').toUpperCase();

  // § ตรวจรูปแบบเข้ม: HN + ตัวเลข 9 หลัก รวม 11 ตัว ไม่งั้น reject เป็น "ไม่พบเรื่อง"
  if (!/^HN\d{9}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * Format tracking code ให้อ่านง่ายบนหน้าจอ: `HN 4837 2915 6`
 * (เว้นวรรคทุก 4 ตัว หลัง prefix)
 */
export function formatTrackingCode(code: string): string {
  // ถ้าเป็น raw code (HNxxxxxxxxx) ให้เติมช่องว่าง ถ้า format แล้วคืนตามเดิม
  const cleaned = code.replace(/\s/g, '');
  // HN + 4 + 4 + 1
  return cleaned.replace(/^(HN)(\d{4})(\d{4})(\d{1})$/, '$1 $2 $3 $4');
}
