// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminDashboardPage from './page';

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn(async () => ({
    user: { id: 'staff-1', fullName: 'แอดมิน ทดสอบ', email: 'admin@test.local', role: 'admin' },
  })),
}));

vi.mock('@/components/admin/admin-shell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/db', async () => {
  return {
    getDb: vi.fn(async () => ({
      select: () => ({
        from: () => {
          const builder = {
            leftJoin: () => builder,
            where: () => builder,
            groupBy: () => builder,
            orderBy: () => builder,
            limit: () => builder,
            then: (onFulfilled: (v: unknown) => unknown) =>
              Promise.resolve([
                { status: 'received', c: 3 },
                { status: 'in_progress', c: 2 },
                { status: 'closed', c: 5 },
              ]).then(onFulfilled),
          };
          return builder;
        },
      }),
    })),
  };
});

vi.mock('@/lib/db/query-helpers', () => ({
  firstOrUndefined: vi.fn(async () => ({
    c: 2, // mock slaBreach count = 2
    date: new Date('2026-10-31'),
    totalReceived: 10,
    totalInProgress: 5,
    totalClosed: 5,
    avgResolutionDays: 2.5,
  })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AdminDashboardPage (admin/page)', () => {
  it('เมื่อมีเคสตกค้าง SLA จะเรนเดอร์แบนเนอร์แจ้งเตือนเป็น Link ไปยัง /admin/reports?overdue=1', async () => {
    const page = await AdminDashboardPage();
    render(page);

    const slaLink = screen.getByRole('link', {
      name: /เลยกำหนด SLA 2 เรื่อง คลิกเพื่อดูคิวเรื่อง/,
    });
    expect(slaLink).toBeInTheDocument();
    expect(slaLink).toHaveAttribute('href', '/admin/reports?overdue=1');
  });

  it('การ์ด KPI เชื่อมโยงไปยังหน้ารายการคิวเรื่องที่ตรงกัน', async () => {
    const page = await AdminDashboardPage();
    render(page);

    // เรื่องรับทั้งหมด -> /admin/reports
    const totalLink = screen.getByRole('link', {
      name: /เรื่องรับทั้งหมด 10 คลิกเพื่อดูรายการ/,
    });
    expect(totalLink).toBeInTheDocument();
    expect(totalLink).toHaveAttribute('href', '/admin/reports');

    // กำลังดำเนินการ -> /admin/reports?status=open
    const inProgressLink = screen.getByRole('link', {
      name: /กำลังดำเนินการ 5 คลิกเพื่อดูรายการ/,
    });
    expect(inProgressLink).toBeInTheDocument();
    expect(inProgressLink).toHaveAttribute('href', '/admin/reports?status=open');

    // ปิดสำเร็จ -> /admin/reports?status=closed
    const closedLink = screen.getByRole('link', {
      name: /ปิดสำเร็จ 5 คลิกเพื่อดูรายการ/,
    });
    expect(closedLink).toBeInTheDocument();
    expect(closedLink).toHaveAttribute('href', '/admin/reports?status=closed');
  });

  it('แต่ละแถวในสถิติตามสถานะเป็น Link ชี้ไปยังคิวสถานะนั้น ๆ', async () => {
    const page = await AdminDashboardPage();
    render(page);

    // เช็คลิงก์สถานะที่มีข้อมูล (เช่น received, in_progress, closed)
    const receivedStatusLink = screen.getByRole('link', {
      name: /ดูเรื่องสถานะ รับเรื่อง จำนวน 3 เรื่อง/,
    });
    expect(receivedStatusLink).toBeInTheDocument();
    expect(receivedStatusLink).toHaveAttribute('href', '/admin/reports?status=received');

    const inProgressStatusLink = screen.getByRole('link', {
      name: /ดูเรื่องสถานะ กำลังดำเนินการ จำนวน 2 เรื่อง/,
    });
    expect(inProgressStatusLink).toBeInTheDocument();
    expect(inProgressStatusLink).toHaveAttribute('href', '/admin/reports?status=in_progress');
  });
});
