/**
 * Thai Date Utilities — ปีงบประมาณ พ.ศ. + fiscal year
 * ไทยใช้ พ.ศ. (พุทธศักราช) = ค.ศ. + 543
 * ปีงบประมาณไทย: 1 ต.ค. - 30 ก.ย. (October 1 - September 30)
 */

/**
 * แปลง Date → พ.ศ. (Buddhist Era year)
 */
export function toBuddhistYear(date: Date): number {
  return date.getFullYear() + 543;
}

/**
 * แปลง พ.ศ. → ค.ศ. (Gregorian year)
 */
export function toGregorianYear(buddhistYear: number): number {
  return buddhistYear - 543;
}

/**
 * ปีงบประมาณไทย (Thai fiscal year) — 1 ต.ค. YYYY-1 → 30 ก.ย. YYYY
 * ถ้าอยู่ระหว่าง ม.ค.-ก.ย. → ปีงบ = ปีปัจจุบัน
 * ถ้าอยู่ระหว่าง ต.ค.-ธ.ค. → ปีงบ = ปีถัดไป
 */
export function getFiscalYear(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed (0=Jan, 9=Oct)

  // Oct-Dec → fiscal year = next year
  if (month >= 9) {
    return year + 1;
  }

  // Jan-Sep → fiscal year = current year
  return year;
}

/**
 * แปลง Date → พ.ศ. string (YYYY-MM-DD format with BE year)
 */
export function toThaiDateString(date: Date): string {
  const year = toBuddhistYear(date);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format Date → readable Thai (DD/MM/BBBB)
 */
export function formatThaiDate(date: Date): string {
  const year = toBuddhistYear(date);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${day}/${month}/${year}`;
}

/* ---------- Display formatters (พ.ศ.) ----------
 * ทุกวันที่ "แสดงให้ผู้ใช้เห็น" ต้องผ่านชุดนี้ — DB เก็บ ค.ศ. (timestamp ปกติ)
 * แต่ UI แสดง พ.ศ. ตามราชการไทย ผ่าน locale extension 'u-ca-buddhist'
 * (สร้าง formatter ครั้งเดียวระดับ module — Intl.DateTimeFormat สร้างแพง) */

const dateTimeFormatter = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
  dateStyle: 'long',
  timeStyle: 'short',
});

const dateLongFormatter = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dateTimeShortFormatter = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** วันที่+เวลาแบบเต็ม → "5 มกราคม 2569 14:30" (หน้ารายละเอียดเคส, audit) */
export function formatThaiDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

/** วันที่แบบยาว ไม่มีเวลา → "5 มกราคม 2569" (รายงานสรุป) */
export function formatThaiDateLong(date: Date): string {
  return dateLongFormatter.format(date);
}

/** วันที่+เวลาแบบย่อ → "5 ม.ค. 2569 14:30" (timeline ติดตามเรื่อง) */
export function formatThaiDateTimeShort(date: Date): string {
  return dateTimeShortFormatter.format(date);
}

/**
 * ปีงบประมาณไทย พ.ศ. (fiscal year in Buddhist Era)
 */
export function getFiscalYearBE(date: Date): number {
  return toBuddhistYear(new Date(getFiscalYear(date), 0, 1));
}
