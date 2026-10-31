import { formatIsoToThaiShort } from './thai-date';

/**
 * § date-range.ts — Date Preset Engine สำหรับระบบจัดการแอดมิน (Tranche F / JSK Port)
 * รองรับการคำนวณช่วงวันที่แบบ ISO (YYYY-MM-DD) ตามปฏิทินไทยและรอบปีงบประมาณราชการ
 * ทำงานบน native Date API โดยไม่เพิ่ม external dependencies (คงขนาด bundle เล็ก)
 */

export interface DatePresetOption {
  key: string;
  label: string;
  days?: number;
  fiscalYear?: boolean;
  todayOnly?: boolean;
}

/** ชุดปุ่ม Preset มาตรฐานสำหรับแอดมิน */
export const STANDARD_DATE_PRESETS: DatePresetOption[] = [
  { key: 'today', label: 'วันนี้', todayOnly: true },
  { key: '7d', label: '7 วัน', days: 7 },
  { key: '30d', label: '30 วัน', days: 30 },
  { key: 'fiscal', label: 'ปีงบประมาณนี้', fiscalYear: true },
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

  if (opt.todayOnly) {
    return { from: to, to };
  }

  if (opt.fiscalYear) {
    // § ปีงบประมาณไทย: เริ่ม 1 ต.ค. (October 1)
    // ถ้าเดือนปัจจุบันคือ ต.ค.-ธ.ค. (index 9-11) -> ปีเริ่มคือปีปัจจุบัน
    // ถ้าเดือนปัจจุบันคือ ม.ค.-ก.ย. (index 0-8) -> ปีเริ่มคือปีก่อนหน้า
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const startYear = currentMonth >= 9 ? currentYear : currentYear - 1;
    const from = `${startYear}-10-01`;
    return { from, to };
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
    if (customStart && customEnd) {
      return { from: customStart, to: customEnd };
    }
    return null;
  }

  const opt = presets.find((p) => p.key === preset);
  if (!opt) return null;
  return presetOptionToDates(opt, now);
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
