import { OPEN_STATUSES, type CaseStatus } from './state-machine';

/**
 * นิยามสถิติตามมาตรฐานงานจริง (Excel Dashboard + state machine)
 *
 * § Excel ใช้ COUNTA ทุกแถวเป็น "เรื่องทั้งหมด" แล้ว COUNTIF คอลัมน์สถานะ
 * แยกยอดรับ/ดำเนินการ/เสร็จ/ปิด — ไม่ได้นับ status='received' เป็นยอดรับทั้งหมด
 * § OPEN_STATUSES คือสถานะที่ยังจบงานไม่ได้ตาม state machine (ไม่รวม done/closed/rejected)
 */
export interface StatusStatsSnapshot {
  totalCases: number;
  totalReceived: number;
  totalClosed: number;
  totalRejected: number;
  totalInProgress: number;
  resolutionRate: number;
  avgResolutionDays: number | null;
}

export function deriveStatusStats(
  statusCounts: Partial<Record<CaseStatus, number>>,
  closedDurationsDays: readonly number[],
): StatusStatsSnapshot {
  const totalCases = Object.values(statusCounts).reduce<number>((sum, n) => sum + (n ?? 0), 0);
  const totalClosed = statusCounts.closed ?? 0;
  const totalRejected = statusCounts.rejected ?? 0;
  const totalInProgress = OPEN_STATUSES.reduce<number>((sum, status) => sum + (statusCounts[status] ?? 0), 0);
  const resolutionRate = totalCases > 0 ? Math.round((totalClosed / totalCases) * 100) : 0;
  const avgResolutionDays = closedDurationsDays.length
    ? Math.round(closedDurationsDays.reduce((sum, days) => sum + days, 0) / closedDurationsDays.length)
    : null;

  return {
    totalCases,
    // § totalReceived ยังหมายถึงสถานะ received เหมือนเดิม เพราะ trend/graph ใช้เป็นยอดรายวัน
    // ยอดทั้งหมดตาม Excel อยู่ใน totalCases แยกต่างหาก
    totalReceived: statusCounts.received ?? 0,
    totalClosed,
    totalRejected,
    totalInProgress,
    resolutionRate,
    avgResolutionDays,
  };
}

/** อ่านยอดเรื่องทั้งหมดจาก metadata ของ snapshot เดิมที่ยังไม่มีคอลัมน์ totalCases */
export function totalCasesFromSnapshot(metadata: unknown): number | null {
  if (typeof metadata !== 'object' || metadata === null || !('totalCases' in metadata)) return null;
  const value = (metadata as { totalCases: unknown }).totalCases;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const bangkokDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** § วันที่ต้องเป็นเวลากรุงเทพ — UTC date ผิดหลัง 17:00 น. ของทุกวัน */
export function bangkokDateKey(date: Date): string {
  return bangkokDateFormatter.format(date);
}

export interface SnapshotStatusCounts {
  received?: number;
  closed?: number;
  rejected?: number;
  inProgress?: number;
}

/** § snapshot รุ่นใหม่เก็บยอดสะสมแยกจากยอดรายวันในคอลัมน์ — เก่าให้ caller fallback ไปคอลัมน์เดิม */
export function statusCountsFromSnapshot(metadata: unknown): SnapshotStatusCounts | null {
  if (typeof metadata !== 'object' || metadata === null || !('statusCounts' in metadata)) return null;
  const value = (metadata as { statusCounts: unknown }).statusCounts;
  if (typeof value !== 'object' || value === null) return null;
  return pickCounts(value as Record<string, unknown>);
}

function pickCounts(value: Record<string, unknown>): SnapshotStatusCounts | null {
  const read = (key: string): number | undefined => {
    const raw = value[key];
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : undefined;
  };
  const result: SnapshotStatusCounts = {};
  for (const key of ['received', 'closed', 'rejected', 'inProgress'] as const) {
    const n = read(key);
    if (n !== undefined) result[key] = n;
  }
  return Object.keys(result).length ? result : null;
}

/**
 * snapshot รุ่นใหม่ (มี metadata.statusCounts) เก็บยอดสะสมในคอลัมน์
 * snapshot รุ่นเก่า (ไม่มี statusCounts) คอลัมน์ totalReceived/totalClosed คือยอดสะสมรุ่นเดิม
 * ใช้แยกยอดรายวันกับยอดสะสมไม่ได้ — ต้องไม่ปนกับกราฟรายวัน (ข้อ 6)
 */
export function isDailySnapshot(metadata: unknown): boolean {
  return statusCountsFromSnapshot(metadata) !== null;
}

/** ยอดรับ/ปิดรายวันของ snapshot แถวเดียว (คอลัมน์เดิมเปลี่ยนความหมายตามวันที่กรุงเทพ) */
export function dailyCountsFromSnapshot(row: { totalReceived: unknown; totalClosed: unknown }): {
  arrivals: number;
  closures: number;
} {
  const toNumber = (value: unknown): number => {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(n) ? n : 0;
  };
  return { arrivals: toNumber(row.totalReceived), closures: toNumber(row.totalClosed) };
}
