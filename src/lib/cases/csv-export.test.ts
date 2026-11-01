import { describe, expect, it } from 'vitest';
import {
  escapeCsvCell,
  formatCaseExportRow,
  generateCasesCsv,
  CASE_CSV_HEADERS,
  type CaseExportRow,
} from './csv-export';

describe('escapeCsvCell', () => {
  it('returns empty string for null and undefined', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell('')).toBe('');
  });

  it('preserves standalone dash placeholder without single-quote prefix', () => {
    expect(escapeCsvCell('-')).toBe('-');
  });

  it('neutralizes spreadsheet formula injection prefixes with leading single quote', () => {
    expect(escapeCsvCell('=1+1')).toBe("'=1+1");
    expect(escapeCsvCell('@SUM(A1:A5)')).toBe("'@SUM(A1:A5)");
    expect(escapeCsvCell('+CMD("calc")')).toBe('"\'+CMD(""calc"")"');
    expect(escapeCsvCell('-100%')).toBe("'-100%");
    expect(escapeCsvCell('\tcmd')).toBe("'\tcmd");
  });

  it('escapes cells containing commas, quotes, and newlines according to RFC 4180', () => {
    expect(escapeCsvCell('Hello, World')).toBe('"Hello, World"');
    expect(escapeCsvCell('He said "Hi"')).toBe('"He said ""Hi"""');
    expect(escapeCsvCell('Line1\nLine2')).toBe('"Line1\nLine2"');
  });
});

describe('formatCaseExportRow & generateCasesCsv', () => {
  const sampleRow: CaseExportRow = {
    trackingCode: 'HG-123456789',
    createdAt: new Date('2026-11-01T09:30:00Z'),
    title: 'ไฟทางดับ',
    description: 'หลอดไฟขาดบริเวณหน้าวัด',
    categoryName: 'ไฟฟ้าสาธารณะ',
    status: 'in_progress',
    priority: 'normal',
    location: 'หน้าวัดหัวงัว',
    village: 'หมู่ 1',
    subDistrictNameTh: 'หัวงัว',
    districtNameTh: 'ยางตลาด',
    provinceNameTh: 'กาฬสินธุ์',
    departmentName: 'กองช่าง',
    assignedOfficerName: 'นายช่าง สดใส',
    budgetStatus: 'has_budget',
    budgetAmount: 1500,
    actionDetails: 'เปลี่ยนหลอด LED แล้ว',
    dueDate: new Date('2026-11-08T00:00:00Z'),
    closedAt: null,
  };

  it('formats row values with Thai status, budget, and formatted dates', () => {
    const formatted = formatCaseExportRow(sampleRow);
    expect(formatted[0]).toBe('HG-123456789');
    expect(formatted[4]).toBe('ไฟฟ้าสาธารณะ');
    expect(formatted[5]).toBe('กำลังดำเนินการ');
    expect(formatted[6]).toBe('ปกติ');
    expect(formatted[12]).toBe('กองช่าง');
    expect(formatted[13]).toBe('นายช่าง สดใส');
    expect(formatted[14]).toBe('มีงบประมาณ');
    expect(formatted[15]).toBe('1,500');
    expect(formatted[18]).toBe('-'); // closedAt is null
  });

  it('generates CSV string with UTF-8 BOM and CRLF line breaks', () => {
    const csv = generateCasesCsv([sampleRow]);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM
    expect(csv).toContain(CASE_CSV_HEADERS.join(','));
    expect(csv).toContain('HG-123456789');
    expect(csv).toContain('\r\n');
  });

  it('handles null values gracefully in all fields (Fixture D)', () => {
    const nullRow: CaseExportRow = {
      trackingCode: null,
      createdAt: new Date('2026-11-01T09:30:00Z'),
      title: 'เรื่องไม่ระบุ',
      description: 'รายละเอียด',
      categoryName: null,
      status: 'pending',
      priority: 'urgent',
      location: 'ไม่ระบุ',
      village: null,
      subDistrictNameTh: null,
      districtNameTh: null,
      provinceNameTh: null,
      departmentName: null,
      assignedOfficerName: null,
      budgetStatus: 'unspecified',
      budgetAmount: null,
      actionDetails: null,
      dueDate: null,
      closedAt: null,
    };
    const formatted = formatCaseExportRow(nullRow);
    expect(formatted[0]).toBe('-');
    expect(formatted[4]).toBe('ไม่ระบุหมวดหมู่');
    expect(formatted[5]).toBe('รอรับเรื่อง');
    expect(formatted[6]).toBe('เร่งด่วน');
    expect(formatted[8]).toBe('-');
    expect(formatted[12]).toBe('ยังไม่มอบหมายหน่วยงาน');
    expect(formatted[13]).toBe('ยังไม่ระบุผู้รับผิดชอบ');
    expect(formatted[14]).toBe('ไม่ระบุ');
    expect(formatted[15]).toBe('-');
    expect(formatted[16]).toBe('-');
    expect(formatted[17]).toBe('-');
    expect(formatted[18]).toBe('-');
  });
});
