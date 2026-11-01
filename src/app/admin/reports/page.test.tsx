// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CaseManagementPage from './page';

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn(async () => ({
    user: { id: 'staff-1', fullName: 'แอดมิน ทดสอบ', email: 'admin@test.local', role: 'admin' },
  })),
}));

vi.mock('@/lib/queries/lookups', () => ({
  getActiveCategories: vi.fn(async () => []),
}));

vi.mock('@/components/admin/admin-shell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/admin/case-filter-bar', () => ({
  CaseFilterBar: () => <div data-testid="filter-bar" />,
}));

vi.mock('@/lib/db', async () => {
  return {
    getDb: vi.fn(async () => ({
      select: () => ({
        from: () => {
          const builder = {
            leftJoin: () => builder,
            where: () => builder,
            orderBy: () => builder,
            limit: () => builder,
            offset: () => Promise.resolve([]),
            then: (onFulfilled: (v: unknown) => unknown) =>
              Promise.resolve([{ c: 0, count: 0, avg: null }]).then(onFulfilled),
          };
          return builder;
        },
      }),
    })),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CaseManagementPage (admin/reports)', () => {
  it('เมื่อ searchParams มี overdue=1 แสดง Active Filter Pill เกินกำหนดเวลา SLA', async () => {
    const page = await CaseManagementPage({
      searchParams: Promise.resolve({ overdue: '1' }),
    });

    render(page);

    expect(screen.getByText(/กำลังกรอง: เรื่องที่เกินกำหนดเวลา \(SLA Breach\)/)).toBeInTheDocument();
    const clearLinks = screen.getAllByRole('link', { name: /ล้างตัวกรอง/ });
    expect(clearLinks.length).toBeGreaterThanOrEqual(1);
    expect(clearLinks[0]).toHaveAttribute('href', '/admin/reports');
  });

  it('เมื่อ searchParams มี status=open แสดง Active Filter Pill เรื่องที่กำลังดำเนินการทั้งหมด', async () => {
    const page = await CaseManagementPage({
      searchParams: Promise.resolve({ status: 'open' }),
    });

    render(page);

    expect(screen.getByText(/กำลังกรอง: เรื่องที่กำลังดำเนินการทั้งหมด \(เคสเปิด\)/)).toBeInTheDocument();
    const clearLinks = screen.getAllByRole('link', { name: /ล้างตัวกรอง/ });
    expect(clearLinks.length).toBeGreaterThanOrEqual(1);
    expect(clearLinks[0]).toHaveAttribute('href', '/admin/reports');
  });

  it('เมื่อไม่มี filter overdue หรือ status=open จะไม่แสดง Active Filter Pill', async () => {
    const page = await CaseManagementPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(screen.queryByText(/กำลังกรอง:/)).not.toBeInTheDocument();
  });
});
