/**
 * Placeholder email ของผู้ใช้สาย LINE — รูปแบบ `line-<localPart>@placeholder.local`
 *
 * § contract ที่ต้องตรงกันสองทิศทาง: src/lib/cases/intake.ts ใช้สร้าง email ตอน
 * resolveSubmitter ส่วน scripts/backfill-line-links.ts ใช้ parse กลับเป็น lineUserId
 * (เดิม format ถูกเขียนซ้ำสองที่ — ถ้าเปลี่ยนที่เดียว script backfill จะพังเงียบ ๆ)
 */

const EMAIL_PREFIX = 'line-';
const EMAIL_SUFFIX = '@placeholder.local';

/** localPart = lineUserId จริง หรือ generateId() กรณี intake ไม่รู้ lineUserId */
export function linePlaceholderEmail(localPart: string): string {
  return `${EMAIL_PREFIX}${localPart}${EMAIL_SUFFIX}`;
}

/** คืน null ถ้า email ไม่ใช่รูปแบบ placeholder สาย LINE */
export function lineUserIdFromPlaceholderEmail(email: string): string | null {
  if (!email.startsWith(EMAIL_PREFIX) || !email.endsWith(EMAIL_SUFFIX)) return null;
  return email.slice(EMAIL_PREFIX.length, email.length - EMAIL_SUFFIX.length);
}
