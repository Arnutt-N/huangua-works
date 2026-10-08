import {
  ALL_STATUSES,
  OPEN_STATUSES,
  type CaseStatus,
} from '@/lib/cases/state-machine';
import { toGregorianYear } from '@/lib/thai-date';
import type {
  CategoryLookup,
  PmqaCategorySummary,
  PmqaMonthlyBreakdown,
  PmqaReportData,
  PmqaStatusCounts,
  RawCaseForPmqa,
} from './types';

/**
 * คำนวณช่วงวันที่เริ่มต้นและสิ้นสุดของปีงบประมาณไทย
 * ตัวอย่าง: พ.ศ. 2569 (ค.ศ. 2026) -> 1 ต.ค. 2025 00:00:00 ถึง 30 ก.ย. 2026 23:59:59.999
 */
export function getFiscalYearDateRange(fiscalYearBE: number): {
  startDate: Date;
  endDate: Date;
} {
  const gregYear = toGregorianYear(fiscalYearBE);
  const startDate = new Date(gregYear - 1, 9, 1, 0, 0, 0, 0); // เดือน 9 = ต.ค. (0-indexed)
  const endDate = new Date(gregYear, 8, 30, 23, 59, 59, 999); // เดือน 8 = ก.ย. (0-indexed)

  return { startDate, endDate };
}

/**
 * สร้าง status counts เริ่มต้นเป็น 0 สำหรับทุกสถานะ
 */
export function createInitialStatusCounts(): PmqaStatusCounts {
  const counts = {} as PmqaStatusCounts;
  for (const status of ALL_STATUSES) {
    counts[status] = 0;
  }
  return counts;
}

/**
 * ตรวจสอบว่าสถานะนี้ถือว่าดำเนินการแล้วเสร็จตามเกณฑ์ PMQA หรือไม่
 * (เสร็จสิ้น หรือ ปิดเรื่องแล้ว)
 */
export function isResolvedStatus(status: CaseStatus): boolean {
  return status === 'done' || status === 'closed';
}

/**
 * คำนวณอัตราความสำเร็จร้อยละ (ทศนิยม 1 ตำแหน่ง)
 */
export function calculateResolutionRate(resolvedCount: number, total: number): number {
  if (total <= 0) return 0;
  const rate = (resolvedCount / total) * 100;
  return Math.round(rate * 10) / 10;
}

/** ข้อมูลแม่แบบ 12 เดือนในรอบปีงบประมาณไทย (เริ่ม ต.ค. ปีก่อนหน้า ถึง ก.ย. ปีงบ) */
export const THAI_FISCAL_MONTHS_CONFIG = [
  { fiscalMonthIndex: 1, calendarMonth: 10, monthName: 'ตุลาคม', yearOffset: -1 },
  { fiscalMonthIndex: 2, calendarMonth: 11, monthName: 'พฤศจิกายน', yearOffset: -1 },
  { fiscalMonthIndex: 3, calendarMonth: 12, monthName: 'ธันวาคม', yearOffset: -1 },
  { fiscalMonthIndex: 4, calendarMonth: 1, monthName: 'มกราคม', yearOffset: 0 },
  { fiscalMonthIndex: 5, calendarMonth: 2, monthName: 'กุมภาพันธ์', yearOffset: 0 },
  { fiscalMonthIndex: 6, calendarMonth: 3, monthName: 'มีนาคม', yearOffset: 0 },
  { fiscalMonthIndex: 7, calendarMonth: 4, monthName: 'เมษายน', yearOffset: 0 },
  { fiscalMonthIndex: 8, calendarMonth: 5, monthName: 'พฤษภาคม', yearOffset: 0 },
  { fiscalMonthIndex: 9, calendarMonth: 6, monthName: 'มิถุนายน', yearOffset: 0 },
  { fiscalMonthIndex: 10, calendarMonth: 7, monthName: 'กรกฎาคม', yearOffset: 0 },
  { fiscalMonthIndex: 11, calendarMonth: 8, monthName: 'สิงหาคม', yearOffset: 0 },
  { fiscalMonthIndex: 12, calendarMonth: 9, monthName: 'กันยายน', yearOffset: 0 },
] as const;

/**
 * รวมสถิติรายเดือนตามปีงบประมาณ
 */
export function aggregateMonthlyBreakdown(
  cases: RawCaseForPmqa[],
  fiscalYearBE: number,
): PmqaMonthlyBreakdown[] {
  const gregYear = toGregorianYear(fiscalYearBE);

  return THAI_FISCAL_MONTHS_CONFIG.map((cfg) => {
    const targetCalendarYear = gregYear + cfg.yearOffset;
    const targetBuddhistYear = fiscalYearBE + cfg.yearOffset;

    // กรองเคสที่สร้างในเดือนและปีที่ตรงกับ slot นี้
    const monthCases = cases.filter((c) => {
      const d = c.createdAt;
      return (
        d.getFullYear() === targetCalendarYear &&
        d.getMonth() === cfg.calendarMonth - 1
      );
    });

    const total = monthCases.length;
    const resolvedCount = monthCases.filter((c) => isResolvedStatus(c.status)).length;
    const openCount = monthCases.filter((c) => OPEN_STATUSES.includes(c.status)).length;
    const rejectedCount = monthCases.filter((c) => c.status === 'rejected').length;

    return {
      fiscalMonthIndex: cfg.fiscalMonthIndex,
      calendarMonth: cfg.calendarMonth,
      calendarYear: targetCalendarYear,
      buddhistYear: targetBuddhistYear,
      monthName: cfg.monthName,
      total,
      resolvedCount,
      openCount,
      rejectedCount,
    };
  });
}

/**
 * รวมสถิติเคสแยกตามหมวดหมู่
 */
export function aggregateCategorySummaries(
  cases: RawCaseForPmqa[],
  categories: CategoryLookup[],
  totalCases: number,
): PmqaCategorySummary[] {
  // สร้าง map ของ categories ทั้งหมดเพื่อให้มีหมวดหมู่ครบถ้วน
  const categoryMap = new Map<string, CategoryLookup>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat);
  }

  // รวมเคสตาม categoryId
  const casesByCategory = new Map<string, RawCaseForPmqa[]>();
  for (const c of cases) {
    const list = casesByCategory.get(c.categoryId) ?? [];
    list.push(c);
    casesByCategory.set(c.categoryId, list);
  }

  // จัดการหมวดหมู่ที่ไม่พบใน lookup (เช่น หมวดหมู่ที่ถูกลบหรือข้อมูลเก่า)
  for (const catId of casesByCategory.keys()) {
    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, { id: catId, name: 'หมวดหมู่อื่นๆ' });
    }
  }

  const summaries: PmqaCategorySummary[] = [];

  for (const [id, cat] of categoryMap.entries()) {
    const catCases = casesByCategory.get(id) ?? [];
    const total = catCases.length;

    const byStatus = createInitialStatusCounts();
    for (const c of catCases) {
      if (byStatus[c.status] !== undefined) {
        byStatus[c.status] += 1;
      }
    }

    const resolvedCount = catCases.filter((c) => isResolvedStatus(c.status)).length;
    const openCount = catCases.filter((c) => OPEN_STATUSES.includes(c.status)).length;
    const rejectedCount = catCases.filter((c) => c.status === 'rejected').length;
    const resolutionRate = calculateResolutionRate(resolvedCount, total);
    const percentageOfTotal =
      totalCases > 0 ? Math.round((total / totalCases) * 1000) / 10 : 0;

    summaries.push({
      categoryId: id,
      categoryName: cat.name,
      total,
      byStatus,
      resolvedCount,
      openCount,
      rejectedCount,
      resolutionRate,
      percentageOfTotal,
    });
  }

  // เรียงลำดับจากจำนวนเคสมากไปหาน้อย
  summaries.sort((a, b) => b.total - a.total || a.categoryName.localeCompare(b.categoryName, 'th'));

  return summaries;
}

/**
 * ฟังก์ชันหลักในการประมวลผลสรุปรายงาน PMQA (Pure function)
 */
export function calculatePmqaReport({
  cases,
  categories,
  fiscalYearBE,
  availableFiscalYears = [fiscalYearBE],
  now = new Date(),
}: {
  cases: RawCaseForPmqa[];
  categories: CategoryLookup[];
  fiscalYearBE: number;
  availableFiscalYears?: number[];
  now?: Date;
}): PmqaReportData {
  const { startDate, endDate } = getFiscalYearDateRange(fiscalYearBE);

  // กรองเฉพาะเคสที่อยู่ในช่วงปีงบประมาณนี้ (เผื่อ caller ส่งเกินมา)
  const filteredCases = cases.filter(
    (c) => c.createdAt >= startDate && c.createdAt <= endDate,
  );

  const totalCases = filteredCases.length;
  const statusCounts = createInitialStatusCounts();

  for (const c of filteredCases) {
    if (statusCounts[c.status] !== undefined) {
      statusCounts[c.status] += 1;
    }
  }

  const resolvedCount = filteredCases.filter((c) => isResolvedStatus(c.status)).length;
  const openCount = filteredCases.filter((c) => OPEN_STATUSES.includes(c.status)).length;
  const rejectedCount = filteredCases.filter((c) => c.status === 'rejected').length;
  const resolutionRate = calculateResolutionRate(resolvedCount, totalCases);

  const categorySummaries = aggregateCategorySummaries(
    filteredCases,
    categories,
    totalCases,
  );

  const monthlyBreakdown = aggregateMonthlyBreakdown(filteredCases, fiscalYearBE);

  return {
    fiscalYear: fiscalYearBE,
    startDate,
    endDate,
    availableFiscalYears: [...availableFiscalYears].sort((a, b) => b - a),
    totalCases,
    resolvedCount,
    openCount,
    rejectedCount,
    resolutionRate,
    statusCounts,
    categories: categorySummaries,
    monthlyBreakdown,
    generatedAt: now,
  };
}
