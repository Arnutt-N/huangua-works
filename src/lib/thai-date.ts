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

/**
 * ปีงบประมาณไทย พ.ศ. (fiscal year in Buddhist Era)
 */
export function getFiscalYearBE(date: Date): number {
  return toBuddhistYear(new Date(getFiscalYear(date), 0, 1));
}
