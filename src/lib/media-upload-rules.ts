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

/**
 * § ตรวจจับ MIME type จาก Magic bytes ของไฟล์จริง
 * รองรับเฉพาะ JPEG, PNG, และ WebP
 */
export function sniffImageMime(bytes: Uint8Array): { mime: string; ext: string } | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}
