import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * close-stale — batch เก่าสุดก่อน + truncated บอก "ยังค้างจริง" (ไม่ต้อง Docker)
 */

const { mockApply, mockLimit, mockOrderBy } = vi.hoisted(() => ({
  mockApply: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({ requireCron: () => ({ ok: true }) }));
vi.mock('@/lib/cases/operations', () => ({
  applyCaseUpdate: mockApply,
  SYSTEM_ACTOR: { userId: 'system', role: 'system' },
}));
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.orderBy = (...args: unknown[]) => {
      mockOrderBy(...args);
      return chain;
    };
    chain.limit = mockLimit;
    return { select: () => chain };
  }),
}));

const { GET } = await import('./route');

function rows(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `case-${i}` }));
}

async function run() {
  const res = await GET(new NextRequest('http://localhost/api/cron/close-stale'));
  return (await res.json()) as { success: boolean; closedCount: number; failedCount: number; truncated: boolean };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApply.mockResolvedValue({ ok: true });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('GET /api/cron/close-stale · batch', () => {
  it('ค้าง 101 → ปิด 100, truncated true, ดึง LIMIT+1 เรียงเก่าสุดก่อน', async () => {
    mockLimit.mockResolvedValue(rows(101));

    const body = await run();

    expect(body.closedCount).toBe(100);
    expect(body.truncated).toBe(true);
    expect(mockApply).toHaveBeenCalledTimes(100);
    expect(mockLimit).toHaveBeenCalledWith(101);
    expect(mockOrderBy).toHaveBeenCalledTimes(1);
  });

  it('ค้างพอดี 100 → truncated false (ไม่บอกค้างหลอก)', async () => {
    mockLimit.mockResolvedValue(rows(100));

    const body = await run();

    expect(body.closedCount).toBe(100);
    expect(body.truncated).toBe(false);
  });

  it('ปิดไม่สำเร็จบางเรื่อง → failedCount + success false', async () => {
    mockLimit.mockResolvedValue(rows(3));
    mockApply.mockResolvedValueOnce({ ok: false, error: 'x' });

    const body = await run();

    expect(body).toMatchObject({ success: false, closedCount: 2, failedCount: 1, truncated: false });
  });
});
