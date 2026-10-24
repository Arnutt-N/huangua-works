// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RichMenuInsightsClient } from './insights-client';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const getRichMenuInsightSummary = vi.fn();
const getRichMenuInsightDaily = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    getRichMenuInsightSummary: (...args: unknown[]) => getRichMenuInsightSummary(...args),
    getRichMenuInsightDaily: (...args: unknown[]) => getRichMenuInsightDaily(...args),
  },
}));

afterEach(() => cleanup());

beforeEach(() => {
  getRichMenuInsightSummary.mockReset();
  getRichMenuInsightDaily.mockReset();
  getRichMenuInsightSummary.mockResolvedValue({
    ok: true,
    data: {
      rich_menu_id: 'richmenu-abc',
      metrics_from: '20261001',
      metrics_to: '20261024',
      impression: { count: 1200, unique_users: 340 },
      clicks: [{ bound: '0', count: 120, unique_users: 90 }],
      privacy_restricted: false,
    },
  });
  getRichMenuInsightDaily.mockResolvedValue({
    ok: true,
    data: {
      rich_menu_id: 'richmenu-abc',
      metrics_from: '20261001',
      metrics_to: '20261024',
      impression: { metrics: [{ date: '20261024', count: 40, unique_users: 20 }] },
      clicks: null,
      privacy_restricted: false,
    },
  });
});

describe('RichMenuInsightsClient', () => {
  it('แสดง KPI + คลิกตามปุ่มจาก LINE Insight', async () => {
    render(<RichMenuInsightsClient menuId="m1" />);
    expect(await screen.findByText('สถิติ Rich Menu')).toBeInTheDocument();
    expect(await screen.findByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('340')).toBeInTheDocument();
    expect(screen.getAllByText('120').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('สรุปคลิกตามปุ่ม')).toBeInTheDocument();
  });

  it('แสดงคำเตือนเมื่อ LINE ซ่อนสถิติเพราะผู้ใช้ไม่ถึง 20 คน', async () => {
    getRichMenuInsightSummary.mockResolvedValue({
      ok: true,
      data: {
        rich_menu_id: 'richmenu-abc',
        metrics_from: null,
        metrics_to: null,
        impression: null,
        clicks: null,
        privacy_restricted: true,
      },
    });
    getRichMenuInsightDaily.mockResolvedValue({
      ok: true,
      data: {
        rich_menu_id: 'richmenu-abc',
        metrics_from: null,
        metrics_to: null,
        impression: null,
        clicks: null,
        privacy_restricted: true,
      },
    });
    render(<RichMenuInsightsClient menuId="m1" />);
    expect(await screen.findByText('ข้อมูลไม่เพียงพอ')).toBeInTheDocument();
    expect(screen.getByText(/อย่างน้อย 20 คน/)).toBeInTheDocument();
  });

  it('API ล้มเหลวแสดง error ไทย', async () => {
    getRichMenuInsightSummary.mockResolvedValue({ ok: false, error: 'ต้อง sync เมนูไป LINE ก่อนดูสถิติ', status: 409 });
    render(<RichMenuInsightsClient menuId="m1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('ต้อง sync เมนูไป LINE ก่อนดูสถิติ');
  });
});
