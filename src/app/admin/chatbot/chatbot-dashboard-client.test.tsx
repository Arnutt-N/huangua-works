// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: { getChatbotStats: vi.fn() },
}));

import { adminApi } from '@/app/admin/_lib/admin-api';
import { ChatbotDashboardClient } from './chatbot-dashboard-client';

const STATS = {
  messages: { totalIn: 10, totalOut: 8 },
  faq: { total: 2, active: 2, hits: 5, hitRate: 80 },
  conversations: { total: 4, active: 1, handoff: 1 },
  topFaq: [{ question: 'เปิดกี่โมง', hitCount: 5 }],
};

function intent(over = {}) {
  return {
    id: 'i1',
    name: 'เวลาทำการ',
    description: null,
    isActive: true,
    keywords: [{ id: 'k1', keyword: 'กี่โมง', matchType: 'contains' }],
    responses: [{ id: 'r1', replyType: 'text', textContent: 'เปิด 08:30', replyObjectId: null, displayOrder: 0 }],
    ...over,
  };
}

const mockStats = vi.mocked(adminApi.getChatbotStats);

function mockIntents(items: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items }),
    } as Response) as unknown as typeof fetch,
  );
}

afterEach(() => {
  cleanup();
  mockStats.mockReset();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mockStats.mockResolvedValue({ ok: true, data: STATS });
});

describe('ChatbotDashboardClient readiness', () => {
  it('หมวดพร้อมแสดงพร้อมและ KPI เดิมอยู่ครบ', async () => {
    mockIntents([intent()]);
    render(<ChatbotDashboardClient />);

    expect(await screen.findByText('เวลาทำการ')).toBeInTheDocument();
    expect(screen.getByText('พร้อม')).toBeInTheDocument();
    expect(screen.getByText('ข้อความเข้า')).toBeInTheDocument();
    expect(screen.getByText('คำถามยอดนิยม (Top FAQ)')).toBeInTheDocument();
  });

  it('หมวดไม่มี keyword แสดงเหตุผลไม่พร้อม', async () => {
    mockIntents([intent({ keywords: [] })]);
    render(<ChatbotDashboardClient />);

    expect(await screen.findByText('ยังไม่มี keyword')).toBeInTheDocument();
  });

  it('ไม่มีหมวดแสดงลิงก์ไปสร้าง', async () => {
    mockIntents([]);
    render(<ChatbotDashboardClient />);

    expect(await screen.findByText('ไปสร้างหมวด')).toBeInTheDocument();
  });
});

describe('ChatbotDashboardClient error', () => {
  it('403 แสดง Forbidden ไม่ใช่ข้อความทั่วไปอย่างเดียว', async () => {
    mockStats.mockResolvedValue({
      ok: false,
      error: 'Forbidden',
      status: 403,
    });
    mockIntents([]);
    render(<ChatbotDashboardClient />);
    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(screen.queryByText('โหลดข้อมูลไม่สำเร็จ')).not.toBeInTheDocument();
  });
});
