import { STATUS_LABELS_TH, type CaseStatus } from './state-machine';
import { BUDGET_LABELS_TH, type BudgetStatus } from './budget';
import { formatThaiDateTimeShort, formatThaiDate } from '@/lib/thai-date';

export interface CaseExportRow {
  trackingCode: string | null;
  createdAt: Date;
  title: string;
  description: string;
  categoryName: string | null;
  status: CaseStatus;
  priority: 'normal' | 'urgent';
  location: string;
  village: string | null;
  subDistrictNameTh: string | null;
  districtNameTh: string | null;
  provinceNameTh: string | null;
  departmentName: string | null;
  assignedOfficerName: string | null;
  budgetStatus: BudgetStatus;
  budgetAmount: number | null;
  actionDetails: string | null;
  dueDate: Date | null;
  closedAt: Date | null;
}

export const CASE_CSV_HEADERS: readonly string[] = [
  'รหัสติดตามเรื่อง',
  'วันที่แจ้ง',
  'หัวข้อเรื่อง',
  'รายละเอียดปัญหา',
  'หมวดหมู่',
  'สถานะการดำเนินงาน',
  'ความเร่งด่วน',
  'สถานที่เกิดเหตุ/จุดสังเกต',
  'หมู่บ้าน/ชุมชน',
  'ตำบล',
  'อำเภอ',
  'จังหวัด',
  'หน่วยงานรับผิดชอบ',
  'เจ้าหน้าที่ผู้รับผิดชอบ',
  'สถานะงบประมาณ',
  'งบประมาณที่ใช้ (บาท)',
  'รายละเอียดการดำเนินงาน',
  'กำหนดแล้วเสร็จ (SLA)',
  'วันที่ปิดเรื่อง',
];

export function escapeCsvCell(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw);
  if (str.length === 0) return '';
  // § ป้องกัน CSV Formula Injection สำหรับสเปรดชีต (ยกเว้น '-' เดี่ยวที่เป็น fallback placeholder)
  const sanitized = /^[=+\-@\t\r]/.test(str) && str !== '-' ? `'${str}` : str;
  // § RFC 4180: ครอบด้วย " หากมีเครื่องหมาย ", comma หรือ newline และ double-quote ตัวใน
  if (/[",\n\r]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export function formatCaseExportRow(row: CaseExportRow): string[] {
  return [
    row.trackingCode ?? '-',
    formatThaiDateTimeShort(row.createdAt),
    row.title,
    row.description,
    row.categoryName ?? 'ไม่ระบุหมวดหมู่',
    STATUS_LABELS_TH[row.status] ?? row.status,
    row.priority === 'urgent' ? 'เร่งด่วน' : 'ปกติ',
    row.location,
    row.village ?? '-',
    row.subDistrictNameTh ?? '-',
    row.districtNameTh ?? '-',
    row.provinceNameTh ?? '-',
    row.departmentName ?? 'ยังไม่มอบหมายหน่วยงาน',
    row.assignedOfficerName ?? 'ยังไม่ระบุผู้รับผิดชอบ',
    BUDGET_LABELS_TH[row.budgetStatus] ?? 'ไม่ระบุ',
    row.budgetAmount !== null ? row.budgetAmount.toLocaleString('th-TH') : '-',
    row.actionDetails ?? '-',
    row.dueDate ? formatThaiDate(row.dueDate) : '-',
    row.closedAt ? formatThaiDateTimeShort(row.closedAt) : '-',
  ];
}

export function generateCasesCsv(rows: CaseExportRow[]): string {
  const BOM = '\uFEFF';
  const headerLine = CASE_CSV_HEADERS.map(escapeCsvCell).join(',');
  const dataLines = rows.map((r) => formatCaseExportRow(r).map(escapeCsvCell).join(','));
  return BOM + [headerLine, ...dataLines].join('\r\n');
}
