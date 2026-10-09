import { and, gte, lte } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { cases, categories } from '@/lib/db/schema';
import { getFiscalYearBE } from '@/lib/thai-date';
import { calculatePmqaReport, getFiscalYearDateRange } from './calculator';
import type { CategoryLookup, PmqaReportData, RawCaseForPmqa } from './types';

/**
 * ดึงข้อมูลรายงานสถิติ PMQA ประจำปีงบประมาณที่ระบุ
 *
 * § สำคัญ: ใช้ getDb() แบบ lazy singleton ภายในฟังก์ชันเท่านั้น
 * ห้าม connect DB ที่ระดับ module scope เด็ดขาด
 */
export async function getPmqaReportData(params?: {
  fiscalYear?: number;
}): Promise<PmqaReportData> {
  const currentFiscalYear = getFiscalYearBE(new Date());
  const selectedFiscalYear =
    params?.fiscalYear && params.fiscalYear > 2500
      ? params.fiscalYear
      : currentFiscalYear;

  const db = await getDb();

  // ดึงช่วงวันที่ของปีงบประมาณที่เลือก
  const { startDate, endDate } = getFiscalYearDateRange(selectedFiscalYear);

  // ดึงข้อมูลเคสที่อยู่ในช่วงปีงบประมาณนี้
  const caseRows = await db
    .select({
      id: cases.id,
      createdAt: cases.createdAt,
      status: cases.status,
      categoryId: cases.categoryId,
    })
    .from(cases)
    .where(
      and(
        gte(cases.createdAt, startDate),
        lte(cases.createdAt, endDate),
      ),
    );

  // ดึงข้อมูลหมวดหมู่ทั้งหมดสำหรับทำ lookup
  const categoryRows = await db
    .select({
      id: categories.id,
      name: categories.name,
    })
    .from(categories);

  // หารายการปีงบประมาณที่มีเคสทั้งหมดในระบบ เพื่อนำมาเป็นตัวเลือกใน dropdown
  // ให้ครอบคลุมปีงบประมาณปัจจุบัน และ 3 ปีย้อนหลังเป็นอย่างน้อย
  const availableYearsSet = new Set<number>();
  availableYearsSet.add(currentFiscalYear);
  availableYearsSet.add(selectedFiscalYear);
  availableYearsSet.add(currentFiscalYear - 1);
  availableYearsSet.add(currentFiscalYear - 2);

  const rawCases: RawCaseForPmqa[] = caseRows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    status: r.status,
    categoryId: r.categoryId,
  }));

  const categoryLookups: CategoryLookup[] = categoryRows.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return calculatePmqaReport({
    cases: rawCases,
    categories: categoryLookups,
    fiscalYearBE: selectedFiscalYear,
    availableFiscalYears: Array.from(availableYearsSet).sort((a, b) => b - a),
  });
}
