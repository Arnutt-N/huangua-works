import { describe, expect, it } from 'vitest';
import { ALL_STATUSES } from '@/lib/cases/state-machine';
import {
  aggregateCategorySummaries,
  aggregateMonthlyBreakdown,
  calculatePmqaReport,
  calculateResolutionRate,
  createInitialStatusCounts,
  getFiscalYearDateRange,
  isResolvedStatus,
} from './calculator';
import type { CategoryLookup, RawCaseForPmqa } from './types';

describe('PMQA Calculator — Fiscal Year & Date Ranges', () => {
  it('คำนวณช่วงวันที่ของปีงบประมาณไทย พ.ศ. 2569 ได้ถูกต้อง (1 ต.ค. 2568 - 30 ก.ย. 2569)', () => {
    const { startDate, endDate } = getFiscalYearDateRange(2569);

    // 2569 พ.ศ. = 2026 ค.ศ.
    // วันเริ่มต้น: 1 ต.ค. 2025 00:00:00.000
    expect(startDate.getFullYear()).toBe(2025);
    expect(startDate.getMonth()).toBe(9); // October
    expect(startDate.getDate()).toBe(1);
    expect(startDate.getHours()).toBe(0);
    expect(startDate.getMinutes()).toBe(0);

    // วันสิ้นสุด: 30 ก.ย. 2026 23:59:59.999
    expect(endDate.getFullYear()).toBe(2026);
    expect(endDate.getMonth()).toBe(8); // September
    expect(endDate.getDate()).toBe(30);
    expect(endDate.getHours()).toBe(23);
    expect(endDate.getMinutes()).toBe(59);
  });
});

describe('PMQA Calculator — Status counts & resolution checks', () => {
  it('สร้าง status counts เริ่มต้นครบ 8 สถานะและมีค่าเป็น 0 ทั้งหมด', () => {
    const initial = createInitialStatusCounts();
    expect(Object.keys(initial)).toHaveLength(ALL_STATUSES.length);
    for (const status of ALL_STATUSES) {
      expect(initial[status]).toBe(0);
    }
  });

  it('ตรวจสอบ isResolvedStatus ได้ถูกต้องเฉพาะ done และ closed', () => {
    expect(isResolvedStatus('done')).toBe(true);
    expect(isResolvedStatus('closed')).toBe(true);
    expect(isResolvedStatus('in_progress')).toBe(false);
    expect(isResolvedStatus('pending')).toBe(false);
    expect(isResolvedStatus('received')).toBe(false);
    expect(isResolvedStatus('reviewing')).toBe(false);
    expect(isResolvedStatus('assigned')).toBe(false);
    expect(isResolvedStatus('rejected')).toBe(false);
  });

  it('คำนวณอัตราความสำเร็จ (Resolution Rate) ถูกต้องและปัดเศษ 1 ตำแหน่ง', () => {
    expect(calculateResolutionRate(0, 0)).toBe(0);
    expect(calculateResolutionRate(5, 10)).toBe(50);
    expect(calculateResolutionRate(1, 3)).toBe(33.3);
    expect(calculateResolutionRate(2, 3)).toBe(66.7);
    expect(calculateResolutionRate(10, 10)).toBe(100);
  });
});

describe('PMQA Calculator — Monthly breakdown', () => {
  it('แบ่ง 12 เดือนในรอบปีงบประมาณ เริ่มจาก ต.ค. ถึง ก.ย. ครบถ้วน', () => {
    const cases: RawCaseForPmqa[] = [
      // เดือน ต.ค. 2025 (เดือนที่ 1 ของปีงบ 2569)
      { id: '1', createdAt: new Date(2025, 9, 15), status: 'done', categoryId: 'c1' },
      // เดือน พ.ย. 2025 (เดือนที่ 2)
      { id: '2', createdAt: new Date(2025, 10, 5), status: 'in_progress', categoryId: 'c1' },
      // เดือน ม.ค. 2026 (เดือนที่ 4)
      { id: '3', createdAt: new Date(2026, 0, 10), status: 'closed', categoryId: 'c2' },
      // เดือน ก.ย. 2026 (เดือนที่ 12)
      { id: '4', createdAt: new Date(2026, 8, 20), status: 'rejected', categoryId: 'c2' },
    ];

    const monthly = aggregateMonthlyBreakdown(cases, 2569);

    expect(monthly).toHaveLength(12);
    // เดือนแรก = ตุลาคม
    expect(monthly[0]?.monthName).toBe('ตุลาคม');
    expect(monthly[0]?.calendarYear).toBe(2025);
    expect(monthly[0]?.buddhistYear).toBe(2568);
    expect(monthly[0]?.total).toBe(1);
    expect(monthly[0]?.resolvedCount).toBe(1);

    // เดือนที่สอง = พฤศจิกายน
    expect(monthly[1]?.monthName).toBe('พฤศจิกายน');
    expect(monthly[1]?.total).toBe(1);
    expect(monthly[1]?.openCount).toBe(1);

    // เดือนที่สี่ = มกราคม
    expect(monthly[3]?.monthName).toBe('มกราคม');
    expect(monthly[3]?.calendarYear).toBe(2026);
    expect(monthly[3]?.buddhistYear).toBe(2569);
    expect(monthly[3]?.total).toBe(1);
    expect(monthly[3]?.resolvedCount).toBe(1);

    // เดือนสุดท้าย = กันยายน
    expect(monthly[11]?.monthName).toBe('กันยายน');
    expect(monthly[11]?.total).toBe(1);
    expect(monthly[11]?.rejectedCount).toBe(1);
  });
});

describe('PMQA Calculator — Category summary', () => {
  it('รวมสถิติแยกตามหมวดหมู่และเรียงลำดับตามจำนวนเคสจากมากไปน้อย', () => {
    const categories: CategoryLookup[] = [
      { id: 'cat-road', name: 'ถนนและสะพาน' },
      { id: 'cat-light', name: 'ไฟฟ้าสาธารณะ' },
      { id: 'cat-water', name: 'น้ำประปา' },
    ];

    const cases: RawCaseForPmqa[] = [
      { id: '1', createdAt: new Date(2026, 0, 1), status: 'done', categoryId: 'cat-road' },
      { id: '2', createdAt: new Date(2026, 0, 2), status: 'in_progress', categoryId: 'cat-road' },
      { id: '3', createdAt: new Date(2026, 0, 3), status: 'closed', categoryId: 'cat-road' },
      { id: '4', createdAt: new Date(2026, 0, 4), status: 'done', categoryId: 'cat-light' },
    ];

    const summaries = aggregateCategorySummaries(cases, categories, cases.length);

    // cat-road มี 3 เรื่อง (อันดับ 1)
    expect(summaries[0]?.categoryId).toBe('cat-road');
    expect(summaries[0]?.total).toBe(3);
    expect(summaries[0]?.resolvedCount).toBe(2); // done + closed
    expect(summaries[0]?.openCount).toBe(1); // in_progress
    expect(summaries[0]?.resolutionRate).toBe(66.7);
    expect(summaries[0]?.percentageOfTotal).toBe(75);

    // cat-light มี 1 เรื่อง (อันดับ 2)
    expect(summaries[1]?.categoryId).toBe('cat-light');
    expect(summaries[1]?.total).toBe(1);
    expect(summaries[1]?.resolvedCount).toBe(1);
    expect(summaries[1]?.resolutionRate).toBe(100);
    expect(summaries[1]?.percentageOfTotal).toBe(25);

    // cat-water ไม่มีเรื่อง (อันดับ 3)
    expect(summaries[2]?.categoryId).toBe('cat-water');
    expect(summaries[2]?.total).toBe(0);
    expect(summaries[2]?.resolutionRate).toBe(0);
    expect(summaries[2]?.percentageOfTotal).toBe(0);
  });
});

describe('PMQA Calculator — Full Report aggregation', () => {
  it('คำนวณรายงาน PMQA ภาพรวมครบถ้วน และกรองเคสนอกปีงบประมาณออกอย่างถูกต้อง', () => {
    const categories: CategoryLookup[] = [
      { id: 'c1', name: 'ถนน' },
      { id: 'c2', name: 'ไฟฟ้า' },
    ];

    const cases: RawCaseForPmqa[] = [
      // ภายในปีงบ 2569 (1 ต.ค. 2025 - 30 ก.ย. 2026)
      { id: '1', createdAt: new Date(2025, 9, 10), status: 'done', categoryId: 'c1' },
      { id: '2', createdAt: new Date(2025, 11, 20), status: 'in_progress', categoryId: 'c1' },
      { id: '3', createdAt: new Date(2026, 2, 15), status: 'closed', categoryId: 'c2' },
      { id: '4', createdAt: new Date(2026, 5, 1), status: 'rejected', categoryId: 'c2' },
      // นอกปีงบ 2569 (เก่ากว่า: 30 ก.ย. 2025)
      { id: '5', createdAt: new Date(2025, 8, 30), status: 'done', categoryId: 'c1' },
      // นอกปีงบ 2569 (ใหม่กว่า: 1 ต.ค. 2026)
      { id: '6', createdAt: new Date(2026, 9, 1), status: 'done', categoryId: 'c1' },
    ];

    const report = calculatePmqaReport({
      cases,
      categories,
      fiscalYearBE: 2569,
      availableFiscalYears: [2568, 2569],
    });

    // มีเคสเข้าเกณฑ์ปี 2569 ทั้งหมด 4 เคส
    expect(report.totalCases).toBe(4);
    expect(report.fiscalYear).toBe(2569);
    expect(report.resolvedCount).toBe(2); // id 1 (done), id 3 (closed)
    expect(report.openCount).toBe(1); // id 2 (in_progress)
    expect(report.rejectedCount).toBe(1); // id 4 (rejected)
    expect(report.resolutionRate).toBe(50); // 2 จาก 4 = 50%

    // statusCounts
    expect(report.statusCounts.done).toBe(1);
    expect(report.statusCounts.closed).toBe(1);
    expect(report.statusCounts.in_progress).toBe(1);
    expect(report.statusCounts.rejected).toBe(1);
    expect(report.statusCounts.pending).toBe(0);

    // availableFiscalYears เรียงจากมากไปน้อย
    expect(report.availableFiscalYears).toEqual([2569, 2568]);
  });

  it('สามารถประมวลผลกรณีไม่มีข้อมูลเรื่องร้องเรียนเลย (Zero Cases) ได้อย่างปลอดภัย', () => {
    const report = calculatePmqaReport({
      cases: [],
      categories: [{ id: 'c1', name: 'ถนน' }],
      fiscalYearBE: 2569,
    });

    expect(report.totalCases).toBe(0);
    expect(report.resolvedCount).toBe(0);
    expect(report.openCount).toBe(0);
    expect(report.rejectedCount).toBe(0);
    expect(report.resolutionRate).toBe(0);
    expect(report.categories[0]?.total).toBe(0);
  });
});
