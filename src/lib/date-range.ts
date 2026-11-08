import { formatIsoToThaiShort } from './thai-date';

/**
 * § date-range.ts — ช่วงวันของตัวกรองแอดมิน (ชุดเดียวกับ JSK หลัง PR #313–#319)
 * `custom` ไม่ใช่ปุ่ม — เป็นเครื่องหมายว่าผู้ใช้แก้ช่องวันที่เอง
 * ทำงานบน native Date API โดยไม่เพิ่ม external dependencies
 */

export interface DatePresetOption {
  key: string;
  label: string;
  days?: number;
  /** 1 ม.ค. ของปีปฏิทินปัจจุบัน ถึงวันนี้ */
  yearToDate?: boolean;
}

/** ชุดปุ่ม Preset มาตรฐานสำหรับแอดมิน — ตรงกับ JSK */
export const STANDARD_DATE_PRESETS: DatePresetOption[] = [
  { key: '7d', label: '7 วัน', days: 7 },
  { key: '30d', label: '30 วัน', days: 30 },
  { key: '90d', label: '90 วัน', days: 90 },
  { key: 'year', label: 'ปีนี้', yearToDate: true },
  { key: 'custom', label: 'กำหนดเอง' },
];

/** แปลง Date → 'YYYY-MM-DD' ตามเวลาท้องถิ่น */
export function toYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** ลบวันจาก Date */
function subDaysNative(d: Date, days: number): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * แปลง DatePresetOption หนึ่งตัวเป็นช่วง { from: YYYY-MM-DD, to: YYYY-MM-DD }
 */
export function presetOptionToDates(
  opt: DatePresetOption,
  now = new Date(),
): { from: string; to: string } {
  const to = toYmd(now);

  if (opt.yearToDate) {
    return { from: `${now.getFullYear()}-01-01`, to };
  }

  const lookback = opt.days ?? 30;
  const from = toYmd(subDaysNative(now, lookback));
  return { from, to };
}

/**
 * คืนค่าช่วงวันจาก preset หรือ custom inputs
 */
export function resolveDateRange(
  preset: string | null,
  customStart: string,
  customEnd: string,
  presets = STANDARD_DATE_PRESETS,
  now = new Date(),
): { from: string; to: string } | null {
  if (!preset) return null;

  if (preset === 'custom') {
    if (customStart && customEnd && customStart <= customEnd) {
      return { from: customStart, to: customEnd };
    }
    return null;
  }

  const opt = presets.find((p) => p.key === preset);
  if (!opt) return null;
  return presetOptionToDates(opt, now);
}

export type CustomRangeProblem = 'incomplete' | 'reversed';

/** ช่วงที่กรอกยังใช้ไม่ได้ — ค่าว่างทั้งคู่ไม่ใช่ความผิดพลาด */
export function customRangeProblem(
  customStart: string,
  customEnd: string,
): CustomRangeProblem | null {
  if (customStart && customEnd && customStart <= customEnd) return null;
  if (!customStart && !customEnd) return null;
  return customStart && customEnd ? 'reversed' : 'incomplete';
}

export const CUSTOM_RANGE_MESSAGES: Record<CustomRangeProblem, string> = {
  incomplete: 'กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด',
  reversed: 'วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด',
};

/** คู่ YYYY-MM-DD ที่วันเริ่มอยู่หลังวันสิ้นสุด — ห้ามเอาไปเป็นเงื่อนไขคิวรี */
export function isReversedDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  return Boolean(from && to && from > to);
}

/**
 * สร้างข้อความสรุปช่วงวันที่ภาษาไทยแบบ พ.ศ.
 * เช่น "1 ต.ค. 2569 – 31 ต.ค. 2569" หรือ "31 ต.ค. 2569" (กรณีวันเดียวกัน)
 */
export function formatDateRangeSummary(from: string, to: string): string {
  if (!from && !to) return '';
  if (from && to && from === to) {
    return formatIsoToThaiShort(from);
  }
  if (from && to) {
    return `${formatIsoToThaiShort(from)} – ${formatIsoToThaiShort(to)}`;
  }
  if (from) {
    return `ตั้งแต่ ${formatIsoToThaiShort(from)}`;
  }
  return `ถึง ${formatIsoToThaiShort(to)}`;
}
