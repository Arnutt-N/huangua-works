// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const selectCalls: { table: unknown }[] = [];
let mockCaseRow: Record<string, unknown> | undefined;
let mockTimelineRows: Record<string, unknown>[] = [];
let mockUserRows: { id: string; fullName: string; role: string }[] = [];

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn(async () => ({
    user: { id: 'staff-1', fullName: 'แอดมิน ทดสอบ', email: 'admin@test.local', role: 'admin' },
  })),
  canUseSupervisorAction: vi.fn(async () => true),
}));

vi.mock('@/lib/queries/lookups', () => ({
  getActiveOfficers: vi.fn(async () => []),
  getActiveDepartments: vi.fn(async () => []),
}));

vi.mock('@/components/admin/admin-shell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./case-detail-client', () => ({
  CaseDetailClient: () => <div data-testid="case-detail-client" />,
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema');
  return {
    getDb: vi.fn(async () => ({
      select: () => ({
        from: (table: unknown) => {
          selectCalls.push({ table });
          const builder = {
            leftJoin: () => builder,
            where: () => builder,
            orderBy: () => Promise.resolve(mockTimelineRows),
            limit: () => Promise.resolve(mockCaseRow ? [mockCaseRow] : []),
            then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(mockUserRows).then(onFulfilled),
          };
          if (table === schema.cases) {
            return builder;
          }
          if (table === schema.caseUpdates) {
            return builder;
          }
          return builder;
        },
      }),
    })),
  };
});

import CaseDetailPage from './page';
import { cases, caseUpdates, users } from '@/lib/db/schema';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  selectCalls.length = 0;
  mockCaseRow = {
    id: 'case-1',
    trackingCode: 'HG69-00001',
    title: 'ท่อประปาแตกหน้าวัด',
    description: 'น้ำไหลท่วมถนน',
    location: 'หน้าวัดบ้านหัวงัว',
    status: 'in_progress',
    priority: 'normal',
    budgetStatus: 'unspecified',
    budgetAmount: null,
    actionDetails: null,
    createdAt: new Date('2026-10-29T08:00:00Z'),
    updatedAt: new Date('2026-10-30T08:00:00Z'),
    dueDate: null,
    closedAt: null,
    categoryId: 'cat-1',
    categoryName: 'ประปา',
    submittedBy: 'citizen-1',
    submitterName: 'นายสมชาย ใจดี',
    submitterPhone: '0812345678',
    assignedTo: 'officer-assigned',
    departmentId: 'dept-1',
    departmentName: 'กองช่าง',
    village: 'หมู่ 1',
    provinceName: 'กาฬสินธุ์',
    districtName: 'ยางตลาด',
    subDistrictName: 'หัวงัว',
    villageName: 'บ้านหัวงัว',
  };
  mockTimelineRows = [
    {
      id: 'u1',
      createdAt: new Date('2026-10-29T09:00:00Z'),
      updateType: 'status_change',
      oldValue: 'pending',
      newValue: 'received',
      comment: 'รับเรื่องแล้ว',
      isPublic: true,
      userId: 'actor-1',
    },
    {
      id: 'u2',
      createdAt: new Date('2026-10-29T10:00:00Z'),
      updateType: 'assignment',
      oldValue: '-',
      newValue: 'ช่างสมศักดิ์',
      comment: null,
      isPublic: false,
      userId: 'actor-2',
    },
    {
      id: 'u3',
      createdAt: new Date('2026-10-29T11:00:00Z'),
      updateType: 'comment',
      oldValue: null,
      newValue: null,
      comment: 'ลงพื้นที่ซ่อมแล้ว',
      isPublic: true,
      userId: 'actor-3',
    },
  ];
  mockUserRows = [
    { id: 'officer-assigned', fullName: 'ช่างสมศักดิ์ รับผิดชอบ', role: 'officer' },
    { id: 'actor-1', fullName: 'ธุรการ ก.', role: 'officer' },
    { id: 'actor-2', fullName: 'หัวหน้า ข.', role: 'supervisor' },
    { id: 'actor-3', fullName: 'นายช่าง ค.', role: 'officer' },
  ];
});

describe('CaseDetailPage — batch user lookup & parallel queries (Tranche G)', () => {
  it('รวม assignedTo + ผู้ทำรายการใน timeline ดึงตาราง users เพียง 1 ครั้ง (ไม่มี N+1)', async () => {
    const jsx = await CaseDetailPage({
      params: Promise.resolve({ id: 'case-1' }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    // แสดงชื่อผู้รับผิดชอบและผู้ทำรายการครบทั้ง 3 คนในไทม์ไลน์
    expect(screen.getByText('ช่างสมศักดิ์ รับผิดชอบ')).toBeInTheDocument();
    expect(screen.getByText(/ธุรการ ก\./)).toBeInTheDocument();
    expect(screen.getByText(/หัวหน้า ข\./)).toBeInTheDocument();
    expect(screen.getByText(/นายช่าง ค\./)).toBeInTheDocument();

    // ตรวจจำนวนการคิวรีตาราง users: ต้องมีเพียง 1 ครั้ง (batch inArray) ไม่ใช่ 1 (assignee) + 3 (actors)
    const userQueries = selectCalls.filter((c) => c.table === users);
    expect(userQueries).toHaveLength(1);
    expect(selectCalls.filter((c) => c.table === cases)).toHaveLength(1);
    expect(selectCalls.filter((c) => c.table === caseUpdates)).toHaveLength(1);
  });

  it('ไม่คิวรีตาราง users เลยเมื่อไม่มี assignedTo และ timeline ว่าง', async () => {
    mockCaseRow = { ...mockCaseRow, assignedTo: null };
    mockTimelineRows = [];

    const jsx = await CaseDetailPage({
      params: Promise.resolve({ id: 'case-1' }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const userQueries = selectCalls.filter((c) => c.table === users);
    expect(userQueries).toHaveLength(0);
  });
});
