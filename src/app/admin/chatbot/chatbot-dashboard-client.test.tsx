// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
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

function mockIntentsOk(items: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items }),
    } as Response) as unknown as typeof fetch,
  );
}

function mockIntentsFail(status: number, error: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve({ error }),
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
    mockIntentsOk([intent()]);
    render(<ChatbotDashboardClient />);

    expect(await screen.findByText('เวลาทำการ')).toBeInTheDocument();
    expect(screen.getByText('พร้อม')).toBeInTheDocument();
    expect(screen.getByText('ข้อความเข้า')).toBeInTheDocument();
    expect(screen.getByText('คำถามยอดนิยม (Top FAQ)')).toBeInTheDocument();
  });

  it('หมวดไม่มี keyword แสดงเหตุผลไม่พร้อม', async () => {
    mockIntentsOk([intent({ keywords: [] })]);
    render(<ChatbotDashboardClient />);

    expect(await screen.findByText('ยังไม่มี keyword')).toBeInTheDocument();
  });

  it('ไม่มีหมวดแสดงลิงก์ไปสร้าง', async () => {
    mockIntentsOk([]);
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
    mockIntentsOk([]);
    render(<ChatbotDashboardClient />);
    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(screen.queryByText('โหลดข้อมูลไม่สำเร็จ')).not.toBeInTheDocument();
  });

  // § intents ล้มต้องเห็น error ของ intents ไม่ใช่ empty state ชวนสร้างหมวดซ้ำ — stats ยังเขียวอยู่
  it('intents 500 แสดง error ไม่ใช่ลิงก์ไปสร้างหมวด', async () => {
    mockIntentsFail(500, 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่');
    render(<ChatbotDashboardClient />);
    expect(await screen.findByText('เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่')).toBeInTheDocument();
    expect(screen.queryByText('ไปสร้างหมวด')).not.toBeInTheDocument();
    // KPI stats ยังต้องอยู่ครบ — error นี้เป็นของ intents อย่างเดียว
    expect(screen.getByText('ข้อความเข้า')).toBeInTheDocument();
  });

  it('intents 403 แสดง error ไม่ใช่ empty state', async () => {
    mockIntentsFail(403, 'สิทธิ์ไม่เพียงพอ');
    render(<ChatbotDashboardClient />);
    expect(await screen.findByText('สิทธิ์ไม่เพียงพอ')).toBeInTheDocument();
    expect(screen.queryByText('ไปสร้างหมวด')).not.toBeInTheDocument();
  });

  // § stats เสร็จก่อนแต่ intents ยังค้าง — ต้องเห็น loading ไม่ใช่ flash false-empty
  it('intents ค้างแต่ stats เสร็จยังแสดง loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => new Promise(() => {})) as unknown as typeof fetch,
    );
    render(<ChatbotDashboardClient />);
    expect(await screen.findByText('กำลังโหลด...')).toBeInTheDocument();
    expect(screen.queryByText('ไปสร้างหมวด')).not.toBeInTheDocument();
    await act(async () => {});
  });
});
