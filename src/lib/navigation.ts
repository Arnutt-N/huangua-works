/**
 * safeInternalPath — ตรวจ return path ก่อนใช้เป็น back link
 *
 * กติกา: (1) ต้องขึ้นต้น `/` (2) ห้ามขึ้นต้น `//` (3) ห้ามมี `\\`
 * (4) ห้ามเป็น absolute URL (5) ห้าม path segment `..` ใด ๆ
 * ไม่ผ่าน → คืน fallback
 */
export function safeInternalPath(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback; // (1)
  if (value.startsWith('//')) return fallback; // (2)
  if (value.includes('\\')) return fallback; // (3)
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return fallback; // (4) absolute URL
  if (value.split('/').includes('..')) return fallback; // (5) path traversal
  return value;
}
