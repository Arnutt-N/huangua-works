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
