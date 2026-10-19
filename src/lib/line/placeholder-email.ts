/**
 * Placeholder email ของผู้ใช้สาย LINE — รูปแบบ `line-<localPart>@placeholder.local`
 *
 * § T5 contract step 5 — ของใหม่ localPart ต้องเป็น hash ไม่ใช่ raw LINE id
 * (resolveLineCitizen ส่ง hash เข้ามาแล้ว) ของเก่า line-<raw>@... ยังอยู่ใน DB
 * เป็นประวัติ — parse กลับได้เฉพาะของเก่า ห้ามสร้างของใหม่แบบ raw อีก
 * § contract ที่ต้องตรงกันสองทิศทาง: src/lib/cases/intake.ts ใช้สร้าง email ตอน
 * resolveSubmitter ส่วน scripts/backfill-line-links.ts ใช้ parse กลับเป็น lineUserId
 * (เดิม format ถูกเขียนซ้ำสองที่ — ถ้าเปลี่ยนที่เดียว script backfill จะพังเงียบ ๆ)
 */

const EMAIL_PREFIX = 'line-';
const EMAIL_SUFFIX = '@placeholder.local';

/** localPart = hash ของ LINE id (ของใหม่) หรือ lineUserId จริง (ของเก่า) หรือ generateId() กรณี intake ไม่รู้ lineUserId */
export function linePlaceholderEmail(localPart: string): string {
  return `${EMAIL_PREFIX}${localPart}${EMAIL_SUFFIX}`;
}

/** คืน null ถ้า email ไม่ใช่รูปแบบ placeholder สาย LINE
 * § คืนค่าเป็น raw id เฉพาะของเก่า — caller ใหม่ห้ามใช้ค่านี้เป็น identity ให้ lookup ผ่าน hash แทน */
export function lineUserIdFromPlaceholderEmail(email: string): string | null {
  if (!email.startsWith(EMAIL_PREFIX) || !email.endsWith(EMAIL_SUFFIX)) return null;
  return email.slice(EMAIL_PREFIX.length, email.length - EMAIL_SUFFIX.length);
}
