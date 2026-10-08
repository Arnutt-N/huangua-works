import type { CaseStatus } from '@/lib/cases/state-machine';

/**
 * โครงสร้างข้อมูลสรุปรายงาน PMQA (Public Sector Management Quality Award)
 * สำหรับ อบต.หัวงัว
 */

/** สรุปจำนวนเคสตามสถานะแต่ละสถานะ */
export type PmqaStatusCounts = Record<CaseStatus, number>;

/** สรุปข้อมูลเคสแยกตามหมวดหมู่ */
export interface PmqaCategorySummary {
  categoryId: string;
  categoryName: string;
  total: number;
  byStatus: PmqaStatusCounts;
  /** ดำเนินการแล้วเสร็จ (done + closed) */
  resolvedCount: number;
  /** อยู่ระหว่างดำเนินการ (OPEN_STATUSES) */
  openCount: number;
  /** ไม่รับดำเนินการ / ยุติเรื่อง (rejected) */
  rejectedCount: number;
  /** ร้อยละการดำเนินการแล้วเสร็จ (0-100) คำนวณจาก resolvedCount / total * 100 */
  resolutionRate: number;
  /** สัดส่วนเทียบกับเรื่องร้องเรียนทั้งหมดในปีงบประมาณ (0-100) */
  percentageOfTotal: number;
}

/** ข้อมูลสรุปรายเดือนในรอบปีงบประมาณ (12 เดือน: ต.ค. ถึง ก.ย.) */
export interface PmqaMonthlyBreakdown {
  /** ลำดับเดือนในรอบปีงบประมาณ 1-12 (1 = ต.ค., 12 = ก.ย.) */
  fiscalMonthIndex: number;
  /** เดือนปฏิทิน 1-12 (1 = ม.ค., 10 = ต.ค.) */
  calendarMonth: number;
  /** ค.ศ. ของเดือนนั้น */
  calendarYear: number;
  /** พ.ศ. ของเดือนนั้น */
  buddhistYear: number;
  /** ชื่อเดือนภาษาไทย เช่น 'ตุลาคม', 'พฤศจิกายน' */
  monthName: string;
  /** จำนวนเรื่องทั้งหมดที่แจ้งในเดือนนี้ */
  total: number;
  /** จำนวนเรื่องที่ดำเนินการแล้วเสร็จ */
  resolvedCount: number;
  /** จำนวนเรื่องที่อยู่ระหว่างดำเนินการ */
  openCount: number;
  /** จำนวนเรื่องที่ไม่รับดำเนินการ */
  rejectedCount: number;
}

/** ข้อมูลรวมทั้งหมดของรายงาน PMQA ประจำปีงบประมาณ */
export interface PmqaReportData {
  /** ปีงบประมาณ พ.ศ. (เช่น 2569) */
  fiscalYear: number;
  /** วันที่เริ่มต้นของปีงบประมาณ (1 ต.ค. ปีก่อนหน้า เวลา 00:00:00) */
  startDate: Date;
  /** วันที่สิ้นสุดของปีงบประมาณ (30 ก.ย. เวลา 23:59:59.999) */
  endDate: Date;
  /** รายการปีงบประมาณทั้งหมดที่มีในระบบ เพื่อใช้ในตัวเลือก dropdown */
  availableFiscalYears: number[];
  /** จำนวนเรื่องร้องเรียนทั้งหมดในปีงบประมาณนี้ */
  totalCases: number;
  /** จำนวนเรื่องที่ดำเนินการแล้วเสร็จ (done + closed) */
  resolvedCount: number;
  /** จำนวนเรื่องที่อยู่ระหว่างดำเนินการ (OPEN_STATUSES) */
  openCount: number;
  /** จำนวนเรื่องที่ไม่รับดำเนินการ (rejected) */
  rejectedCount: number;
  /** อัตราความสำเร็จในการแก้ไขปัญหาภาพรวม (%) */
  resolutionRate: number;
  /** การนับจำนวนแยกตามแต่ละสถานะ */
  statusCounts: PmqaStatusCounts;
  /** สรุปแยกตามหมวดหมู่ */
  categories: PmqaCategorySummary[];
  /** สรุปแยกรายเดือนในรอบปีงบประมาณ */
  monthlyBreakdown: PmqaMonthlyBreakdown[];
  /** เวลาที่สร้างรายงาน */
  generatedAt: Date;
}

/** ข้อมูลดิบของเคสสำหรับนำมาคำนวณใน PMQA calculator */
export interface RawCaseForPmqa {
  id: string;
  createdAt: Date;
  status: CaseStatus;
  categoryId: string;
}

/** ข้อมูลดิบของหมวดหมู่ */
export interface CategoryLookup {
  id: string;
  name: string;
}
