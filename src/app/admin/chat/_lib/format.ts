/** เวลาแบบสั้นสำหรับ bubble — 14:05 */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** วันที่สำหรับ date separator — วันนี้ / เมื่อวาน / 12 ม.ค. 2569 */
export function formatDateSeparator(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return 'วันนี้';
  if (sameDay(date, yesterday)) return 'เมื่อวาน';
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * เวลาสัมพัทธ์สำหรับรายการสนทนา — "เมื่อสักครู่ / 5 นาทีที่แล้ว / 3 วันที่แล้ว"
 *
 * § ใช้สเกล/ถ้อยคำตาม jsk relativeTime (chat-histories page.tsx) ทั้งหมด ไม่ตัดเหลือ "5 นาที"
 * แบบเก่า เพราะข้อความไม่มี "ที่แล้ว" อ่านแล้วเหมือน duration ไม่ใช่เวลาที่ผ่านไป
 * และไม่ตัดกลับเป็นวันที่สั้นเมื่อเกินสัปดาห์ — ผู้ใช้คุ้นกับ "N เดือนที่แล้ว / N ปีที่แล้ว"
 */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'เมื่อสักครู่';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} วันที่แล้ว`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} เดือนที่แล้ว`;
  return `${Math.floor(months / 12)} ปีที่แล้ว`;
}
