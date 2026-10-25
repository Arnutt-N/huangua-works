// § แยกออกจาก route เพราะ Next ตรวจ export ของ route module (เฉพาะ HTTP method + config)
const DATE_RE = /^\d{8}$/;
const SUMMARY_MAX_DAYS = 396;
const DAILY_MAX_DAYS = 99;
const LOOKBACK_DAYS = 365 * 3;

function parseYyyymmdd(v: string): Date | null {
  if (!DATE_RE.test(v)) return null;
  const year = Number(v.slice(0, 4));
  const month = Number(v.slice(4, 6));
  const day = Number(v.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

function validate(from: string, to: string, maxDays: number): string | null {
  const f = parseYyyymmdd(from);
  const t = parseYyyymmdd(to);
  if (!f || !t) return 'รูปแบบวันที่ต้องเป็น yyyyMMdd';
  if (f > t) return 'วันเริ่มต้องไม่หลังวันสิ้นสุด';
  if ((t.getTime() - f.getTime()) / 86_400_000 > maxDays) return `ช่วงวันที่ต้องไม่เกิน ${maxDays} วัน`;
  if (Date.now() - f.getTime() > LOOKBACK_DAYS * 86_400_000) return 'ย้อนหลังได้ไม่เกิน 3 ปี';
  return null;
}

export function validateInsightRange(from: string, to: string): string | null {
  return validate(from, to, SUMMARY_MAX_DAYS);
}

export function validateInsightDailyRange(from: string, to: string): string | null {
  return validate(from, to, DAILY_MAX_DAYS);
}
