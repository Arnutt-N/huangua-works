// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PmqaReportPage from './page';
import type { PmqaReportData } from '@/lib/pmqa/types';

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn(async () => ({
    user: { id: 'staff-1', fullName: 'เจ้าหน้าที่ ทดสอบ', email: 'staff@test.local', role: 'admin' },
  })),
}));

vi.mock('@/components/admin/admin-shell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <div data-testid="admin-shell">{children}</div>,
}));

const mockReportData: PmqaReportData = {
  fiscalYear: 2568,
  startDate: new Date('2024-10-01T00:00:00Z'),
  endDate: new Date('2025-09-30T23:59:59.999Z'),
  availableFiscalYears: [2566, 2567, 2568],
  totalCases: 100,
  resolvedCount: 85,
  openCount: 10,
  rejectedCount: 5,
  resolutionRate: 85,
  statusCounts: {
    pending: 3,
    received: 2,
    reviewing: 2,
    awaiting_budget: 0,
    assigned: 3,
    in_progress: 0,
    done: 80,
    closed: 5,
    rejected: 5,
  },
  categories: [
    {
      categoryId: 'cat-roads',
      categoryName: 'ถนนและสะพาน',
      total: 60,
      percentageOfTotal: 60,
      byStatus: {
        pending: 0,
        received: 0,
        reviewing: 2,
        awaiting_budget: 0,
        assigned: 2,
        in_progress: 0,
        done: 55,
        closed: 0,
        rejected: 1,
      },
      resolvedCount: 55,
      openCount: 4,
      rejectedCount: 1,
      resolutionRate: 91.7,
    },
  ],
  monthlyBreakdown: [
    {
      fiscalMonthIndex: 1,
      calendarMonth: 10,
      calendarYear: 2024,
      buddhistYear: 2567,
      monthName: 'ตุลาคม',
      total: 10,
      resolvedCount: 8,
      openCount: 1,
      rejectedCount: 1,
    },
  ],
  generatedAt: new Date('2026-11-02T10:00:00Z'),
};

const mockGetPmqaReportData = vi.fn(async (_params?: { fiscalYear?: number }) => mockReportData);

vi.mock('@/lib/pmqa', () => ({
  getPmqaReportData: (args?: { fiscalYear?: number }) => mockGetPmqaReportData(args),
}));

describe('PmqaReportPage (/admin/reports/pmqa)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders PrintButton with accessible name', async () => {
    const page = await PmqaReportPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    const printBtn = screen.getByRole('button', { name: /พิมพ์รายงาน/i });
    expect(printBtn).toBeInTheDocument();
    expect(printBtn).toHaveClass('print:hidden');
  });

  it('renders official Thai government letterhead with print:block', async () => {
    const page = await PmqaReportPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    const letterhead = screen.getByText(/องค์การบริหารส่วนตำบลหัวงัว อำเภอยางตลาด จังหวัดกาฬสินธุ์/i);
    expect(letterhead).toBeInTheDocument();

    const letterheadWrapper = letterhead.closest('div');
    expect(letterheadWrapper).toHaveClass('hidden');
    expect(letterheadWrapper).toHaveClass('print:block');
  });

  it('hides normal screen header and navigation controls in print mode', async () => {
    const page = await PmqaReportPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    const backLink = screen.getByRole('link', { name: /กลับไปหน้าจัดการเรื่อง/i });
    const screenNavWrapper = backLink.closest('.print\\:hidden');
    expect(screenNavWrapper).toBeInTheDocument();
  });

  it('renders official administrative sign-off block with print:block and break-inside-avoid', async () => {
    const page = await PmqaReportPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    const mayorSign = screen.getByText(/นายกองค์การบริหารส่วนตำบลหัวงัว/i);
    expect(mayorSign).toBeInTheDocument();

    const signWrapper = mayorSign.closest('.print\\:block');
    expect(signWrapper).toBeInTheDocument();
    expect(signWrapper).toHaveClass('print:break-inside-avoid');
  });

  it('passes parsed fiscalYear searchParam to getPmqaReportData', async () => {
    await PmqaReportPage({
      searchParams: Promise.resolve({ fiscalYear: '2567' }),
    });

    expect(mockGetPmqaReportData).toHaveBeenCalledWith({ fiscalYear: 2567 });
  });

  it('handles empty categories list without error', async () => {
    mockGetPmqaReportData.mockResolvedValueOnce({
      ...mockReportData,
      categories: [],
    });

    const page = await PmqaReportPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(screen.getByText(/ไม่พบข้อมูลหมวดหมู่เรื่องร้องเรียน/i)).toBeInTheDocument();
  });

  it('handles zero total cases without error or NaN%', async () => {
    mockGetPmqaReportData.mockResolvedValueOnce({
      ...mockReportData,
      totalCases: 0,
      resolvedCount: 0,
      openCount: 0,
      rejectedCount: 0,
      resolutionRate: 0,
      categories: [],
    });

    const page = await PmqaReportPage({
      searchParams: Promise.resolve({}),
    });

    const { container } = render(page);

    expect(container.textContent).not.toContain('NaN%');
  });
});
