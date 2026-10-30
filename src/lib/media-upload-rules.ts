/**
 * § กติกาไฟล์สื่อที่แอดมินอัปโหลดได้ — แหล่งเดียวที่ทั้ง API (`/api/line/admin/media`)
 * และหน้า `/admin/files` อ่านร่วมกัน ไม่ import อะไรเลย จึงใช้ใน client bundle ได้
 * ถ้าแยกประกาศสองที่ ตัวเลือกไฟล์ในหน้าจอจะ drift จากข้อจำกัดของเซิร์ฟเวอร์ (FORM-04)
 * เซิร์ฟเวอร์ยังเป็นผู้ตัดสินสุดท้ายเสมอ — ฝั่ง client ตรวจเพื่อไม่ต้องรออัปโหลดเสียเปล่า
 */

/** LINE rich menu / image message รับแค่ภาพ — กัน SVG/HTML ที่ถูกเสิร์ฟกลับพร้อม Content-Type ที่ client บอก */
export const MEDIA_ALLOWED_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const MEDIA_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/** ค่าสำหรับ `<input accept>` */
export const MEDIA_ACCEPT_ATTR = Object.keys(MEDIA_ALLOWED_MIME).join(',');

export const MEDIA_TYPE_ERROR = 'รองรับเฉพาะไฟล์ภาพ PNG, JPEG, WebP';
export const MEDIA_SIZE_ERROR = 'ไฟล์ใหญ่เกิน 10MB';

/** คืนข้อความผิดพลาดภาษาไทย หรือ null เมื่อไฟล์ผ่านกติกา */
export function validateMediaFile(file: { type: string; size: number }): string | null {
  if (!MEDIA_ALLOWED_MIME[file.type]) return MEDIA_TYPE_ERROR;
  if (file.size > MEDIA_MAX_SIZE_BYTES) return MEDIA_SIZE_ERROR;
  return null;
}
