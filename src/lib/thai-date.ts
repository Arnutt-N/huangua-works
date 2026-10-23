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

const fiscalYearFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: 'numeric',
});

/**
 * ปีงบประมาณไทย (Thai fiscal year) — 1 ต.ค. YYYY-1 → 30 ก.ย. YYYY
 * ถ้าอยู่ระหว่าง ม.ค.-ก.ย. → ปีงบ = ปีปัจจุบัน
 * ถ้าอยู่ระหว่าง ต.ค.-ธ.ค. → ปีงบ = ปีถัดไป
 */
export function getFiscalYear(date: Date): number {
  const parts = fiscalYearFormatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);

  return month >= 10 ? year + 1 : year;
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
  return getFiscalYear(date) + 543;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseValidIsoYmd(isoDate: string): { year: number; month: number; day: number } | null {
  const m = ISO_DATE_PATTERN.exec(isoDate.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * แปลง YYYY-MM-DD (ค.ศ.) เป็นเวลาเริ่มต้นของวันตามเวลาไทย (00:00:00.000+07:00)
 */
export function parseThaiDateStart(isoDate: string | null | undefined): Date | null {
  if (!isoDate) return null;
  const ymd = parseValidIsoYmd(isoDate);
  if (!ymd) return null;
  const mm = String(ymd.month).padStart(2, '0');
  const dd = String(ymd.day).padStart(2, '0');
  return new Date(`${ymd.year}-${mm}-${dd}T00:00:00.000+07:00`);
}

/**
 * แปลง YYYY-MM-DD (ค.ศ.) เป็นเวลาสิ้นสุดของวันตามเวลาไทย (23:59:59.999+07:00)
 */
export function parseThaiDateEnd(isoDate: string | null | undefined): Date | null {
  if (!isoDate) return null;
  const ymd = parseValidIsoYmd(isoDate);
  if (!ymd) return null;
  const mm = String(ymd.month).padStart(2, '0');
  const dd = String(ymd.day).padStart(2, '0');
  return new Date(`${ymd.year}-${mm}-${dd}T23:59:59.999+07:00`);
}

export const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const;

export const THAI_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const;

/**
 * แปลง YYYY-MM-DD เป็นข้อความวันที่ไทยแบบสั้น เช่น "23 ต.ค. 2569"
 */
export function formatIsoToThaiShort(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const ymd = parseValidIsoYmd(isoDate);
  if (!ymd) return '';
  return `${ymd.day} ${THAI_MONTHS_SHORT[ymd.month - 1]} ${ymd.year + 543}`;
}
