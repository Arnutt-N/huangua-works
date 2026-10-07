/**
 * เวลาทำการของเจ้าหน้าที่ (chatSettings.business_hours)
 *
 * pure module (ไม่ import อะไร) — ใช้ได้ทั้งบอทฝั่ง server และหน้า settings ฝั่ง client
 * ทุกฟังก์ชันรับ `now` จากผู้เรียก ไม่อ่านนาฬิกาเอง เพื่อให้ test กำหนดเวลาได้แน่นอน
 */

export interface BusinessHours {
  /** 'HH:MM' เวลาไทย — นับรวมนาทีนี้ */
  start: string;
  /** 'HH:MM' เวลาไทย — ไม่นับรวมนาทีนี้; '24:00' = สิ้นวัน */
  end: string;
  /** เลขวันแบบ Date#getDay: 0 = อาทิตย์ … 6 = เสาร์ */
  days: number[];
}

/** ป้ายชื่อวันเรียงตาม getDay — หน้า settings ใช้ชุดเดียวกันนี้ */
export const BUSINESS_DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

// § ประเทศไทยไม่มี DST — offset +07:00 คงที่ตลอดปี จึงบวกเวลาแล้วอ่านด้วย getUTC* ได้
// ผลเหมือนกันทุกเครื่อง ไม่ขึ้นกับ TZ ของ process (Vercel = UTC, เครื่อง dev = Asia/Bangkok)
// ห้ามเปลี่ยนไปใช้ getDay()/getHours() ตรง ๆ — บน Vercel จะคลาด 7 ชั่วโมงแบบเงียบ ๆ
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

export function parseClockMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total <= MINUTES_PER_DAY ? total : null;
}

export function bangkokClock(now: Date): { day: number; minutes: number } {
  const shifted = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  return {
    day: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function isWithinBusinessHours(
  hours: BusinessHours | null | undefined,
  now: Date,
): boolean {
  // § ค่าใน DB เป็น jsonb ที่ไม่มีใคร validate ตอนอ่าน — ถ้าเสียให้ถือว่า "อยู่ในเวลาทำการ"
  // เพื่อคงพฤติกรรมเดิม (handoff ได้เสมอ) แทนที่จะปิดช่องทางคุยกับเจ้าหน้าที่ทั้งหมดแบบเงียบ ๆ
  if (!hours || !Array.isArray(hours.days)) return true;
  const start = parseClockMinutes(hours.start);
  const end = parseClockMinutes(hours.end);
  if (start === null || end === null || start >= end) return true;

  const { day, minutes } = bangkokClock(now);
  return hours.days.includes(day) && minutes >= start && minutes < end;
}

export function formatBusinessHours(hours: BusinessHours): string {
  const labels = [...new Set(hours.days)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map((d) => BUSINESS_DAY_LABELS[d]);
  if (labels.length === 0) return 'ยังไม่ได้กำหนดวันทำการ';
  return `วัน ${labels.join(', ')} เวลา ${hours.start}–${hours.end} น.`;
}

export function outsideBusinessHoursText(hours: BusinessHours): string {
  return [
    'ขณะนี้อยู่นอกเวลาทำการของเจ้าหน้าที่',
    `(${formatBusinessHours(hours)})`,
    '',
    'กรุณาติดต่อเจ้าหน้าที่อีกครั้งในเวลาทำการ ระหว่างนี้ยังใช้บริการได้:',
    '• "แจ้งเรื่องใหม่" — แจ้งเรื่อง',
    '• "ติดตาม HGxxxxxxxxx" — ตรวจสอบสถานะ',
  ].join('\n');
}
