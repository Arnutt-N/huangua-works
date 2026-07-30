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

/** LINE userId ยาว 33 ตัว — โชว์แค่หัวพอระบุตัว ไม่เผยทั้งเส้น */
export function maskLineUserId(lineUserId: string): string {
  return lineUserId.slice(0, 8);
}

/** เวลาสัมพัทธ์แบบสั้นสำหรับรายการสนทนา — 5 นาที / 3 ชม. / 2 วัน */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'เมื่อสักครู่';
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชม.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} วัน`;
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}
