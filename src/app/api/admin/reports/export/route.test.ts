import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireStaffApi: vi.fn(),
  logAudit: vi.fn(),
  dbSelect: vi.fn(),
}));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: mocks.requireStaffApi,
}));

vi.mock('@/lib/audit', () => ({
  logAudit: mocks.logAudit,
  AUDIT_ACTIONS: {
    CASE_EXPORT_CSV: 'case_export_csv',
  },
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({
    select: mocks.dbSelect,
  })),
}));

import { GET } from './route';

describe('GET /api/admin/reports/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 response if staff authorization fails', async () => {
    mocks.requireStaffApi.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const req = new NextRequest('http://localhost:3000/api/admin/reports/export');
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(mocks.dbSelect).not.toHaveBeenCalled();
  });

  it('exports CSV with correct headers and audit log when authorized', async () => {
    mocks.requireStaffApi.mockResolvedValueOnce({
      ok: true,
      ctx: { user: { id: 'staff-1', role: 'officer' } },
    });

    const mockQueryChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValueOnce([
        {
          trackingCode: 'HG-999',
          createdAt: new Date('2026-11-01T10:00:00Z'),
          title: 'ถนนชำรุด',
          description: 'เป็นหลุมเป็นบ่อ',
          categoryName: 'ถนน',
          status: 'received',
          priority: 'urgent',
          location: 'ซอย 4',
          village: 'หมู่ 2',
          subDistrictNameTh: 'หัวงัว',
          districtNameTh: 'ยางตลาด',
          provinceNameTh: 'กาฬสินธุ์',
          departmentName: 'กองช่าง',
          assignedOfficerName: 'นายช่าง สดใส',
          budgetStatus: 'unspecified',
          budgetAmount: null,
          actionDetails: null,
          dueDate: null,
          closedAt: null,
        },
      ]),
    };
    mocks.dbSelect.mockReturnValueOnce(mockQueryChain);

    const req = new NextRequest('http://localhost:3000/api/admin/reports/export?status=received');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment; filename="cases-report-\d{8}-\d{6}\.csv"/);

    const buf = Buffer.from(await res.arrayBuffer());
    // UTF-8 BOM is 0xEF, 0xBB, 0xBF
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);

    const text = buf.toString('utf-8');
    expect(text).toContain('HG-999');
    expect(text).toContain('ถนนชำรุด');
    expect(text).toContain('รับเรื่อง');

    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'staff-1',
        action: 'case_export_csv',
        resource: 'cases',
      }),
    );
  });
});
