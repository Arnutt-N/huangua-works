// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock('@/lib/db', () => ({ getDb }));

vi.mock('framer-motion', async () => {
  const { createElement } = await import('react');
  const motion = Object.fromEntries(['div', 'span', 'p'].map((tag) => [
    tag,
    (props: Record<string, unknown>) => createElement(
      tag,
      Object.fromEntries(Object.entries(props).filter(([key]) => !['initial', 'whileInView', 'viewport', 'transition'].includes(key))),
    ),
  ]));
  return { motion };
});

import { Stats } from './Stats';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mockSnapshot(row: Record<string, unknown>) {
  const builder = {
    from: () => builder,
    orderBy: () => builder,
    limit: async () => [row],
  };
  getDb.mockResolvedValue({ select: () => builder });
}

describe('Stats · KPI จาก snapshot', () => {
  it('ยอดปิดสำเร็จอ่านจากยอดสะสมใน metadata ไม่ใช่ยอดปิดรายวัน', async () => {
    mockSnapshot({
      date: '2026-11-26',
      totalReceived: 2,
      totalClosed: 1,
      totalInProgress: 5,
      avgResolutionDays: 3,
      metadata: { totalCases: 42, statusCounts: { closed: 9, received: 4 } },
    });

    render(await Stats());

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('snapshot เก่าไม่มี statusCounts → ยังอ่านยอดเดิมได้', async () => {
    mockSnapshot({
      date: '2026-11-26',
      totalReceived: 7,
      totalClosed: 6,
      totalInProgress: 2,
      avgResolutionDays: null,
      metadata: { refreshedAt: 'x' },
    });

    render(await Stats());

    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });
});
