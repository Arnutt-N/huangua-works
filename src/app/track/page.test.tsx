// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCookies,
  mockListMyCases,
  mockReadLiffSessionValue,
  mockFindLineUserByRaw,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockListMyCases: vi.fn(),
  mockReadLiffSessionValue: vi.fn(),
  mockFindLineUserByRaw: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/lib/cases/citizen-access', () => ({
  listMyCases: mockListMyCases,
}));

vi.mock('@/lib/liff/session', () => ({
  LIFF_SESSION_COOKIE: 'liff_session',
  readLiffSessionValue: mockReadLiffSessionValue,
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({})),
}));

vi.mock('@/lib/line/identity', () => ({
  findLineUserByRaw: mockFindLineUserByRaw,
}));

vi.mock('@/components/landing/Navbar', () => ({
  Navbar: () => <nav data-testid="navbar">Navbar</nav>,
}));

vi.mock('../../components/site/site-footer', () => ({
  SiteFooter: () => <footer data-testid="footer">Footer</footer>,
}));

vi.mock('@/components/liff/liff-provider', () => ({
  LiffProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./track-form', () => ({
  TrackForm: ({ initialId }: { initialId?: string }) => (
    <div data-testid="track-form" data-initial-id={initialId} />
  ),
}));

import TrackPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mockCookies.mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  });
  mockReadLiffSessionValue.mockReturnValue(null);
  mockListMyCases.mockResolvedValue([]);
  mockFindLineUserByRaw.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
});

describe('TrackPage (/track)', () => {
  it('ไม่มี LIFF session → ไม่แสดง banner บัญชี LINE หรือ empty cases', async () => {
    const page = await TrackPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.queryByTestId('liff-connected-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('liff-empty-cases')).not.toBeInTheDocument();
    expect(screen.queryByTestId('my-cases-list')).not.toBeInTheDocument();
    expect(screen.getByTestId('track-form')).toBeInTheDocument();
  });

  it('มี LIFF session แต่ไม่มีเคส (0 เคส) → แสดง connected banner พร้อม avatar/ชื่อ และ empty state พร้อมปุ่มแจ้งเรื่องใหม่', async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'valid-session' }),
    });
    mockReadLiffSessionValue.mockReturnValue({ lineUserId: 'Utest123', expiresAt: 9999999999 });
    mockFindLineUserByRaw.mockResolvedValue({
      displayName: 'สมศักดิ์ ภักดี',
      pictureUrl: 'https://profile.line-scdn.net/somsak.png',
    });
    mockListMyCases.mockResolvedValue([]);

    const page = await TrackPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    const banner = screen.getByTestId('liff-connected-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('บัญชี LINE: สมศักดิ์ ภักดี');
    const avatar = banner.querySelector('img');
    expect(avatar).toHaveAttribute('src', 'https://profile.line-scdn.net/somsak.png');

    const emptyCases = screen.getByTestId('liff-empty-cases');
    expect(emptyCases).toBeInTheDocument();
    expect(emptyCases).toHaveTextContent('ยังไม่มีรายการเรื่องแจ้งจากบัญชี LINE นี้');

    const newCaseBtn = screen.getByRole('link', { name: 'แจ้งเรื่องใหม่' });
    expect(newCaseBtn).toHaveAttribute('href', '/intake');
  });

  it('มี LIFF session และมีรายการเคส → แสดง connected banner และรายการเรื่องของฉัน', async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'valid-session' }),
    });
    mockReadLiffSessionValue.mockReturnValue({ lineUserId: 'Utest123', expiresAt: 9999999999 });
    mockFindLineUserByRaw.mockResolvedValue({
      displayName: 'สมศักดิ์ ภักดี',
      pictureUrl: null,
    });
    mockListMyCases.mockResolvedValue([
      {
        trackingCode: 'HG123456789',
        status: 'in_progress',
        title: 'ซ่อมแซมไฟกิ่งทางเข้าหมู่บ้าน',
        updatedAt: '2026-11-01T10:00:00.000Z',
      },
    ]);

    const page = await TrackPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByTestId('liff-connected-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('liff-empty-cases')).not.toBeInTheDocument();

    const casesList = screen.getByTestId('my-cases-list');
    expect(casesList).toBeInTheDocument();
    expect(casesList).toHaveTextContent('HG123456789');
    expect(casesList).toHaveTextContent('ซ่อมแซมไฟกิ่งทางเข้าหมู่บ้าน');
  });

  it('เมื่อมี searchParam id → แสดงปุ่มย้อนกลับสู่รายการเรื่องของฉัน', async () => {
    const page = await TrackPage({
      searchParams: Promise.resolve({ id: 'HG987654321' }),
    });
    render(page);

    const backLink = screen.getByRole('link', { name: 'กลับสู่รายการเรื่องของฉัน' });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/track');

    const trackForm = screen.getByTestId('track-form');
    expect(trackForm).toHaveAttribute('data-initial-id', 'HG987654321');
  });
});
