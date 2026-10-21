// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntentItem } from '@/app/admin/_lib/admin-api';
import { IntentDetailClient } from './intent-detail-client';

const listIntents = vi.fn();
const updateIntent = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listIntents: (...args: unknown[]) => listIntents(...args),
    updateIntent: (...args: unknown[]) => updateIntent(...args),
  },
}));

function intent(over: Partial<IntentItem> = {}): IntentItem {
  return {
    id: 'i1',
    name: 'เวลาทำการ',
    description: 'ตอบเรื่องเวลา',
    isActive: true,
    keywords: [{ id: 'k1', keyword: 'กี่โมง', matchType: 'contains' }],
    responses: [
      { id: 'r1', replyType: 'text', textContent: 'เปิด 08:30', replyObjectId: null, displayOrder: 0 },
    ],
    ...over,
  };
}

afterEach(() => cleanup());

beforeEach(() => {
  listIntents.mockReset();
  updateIntent.mockReset();
  listIntents.mockResolvedValue({ ok: true, data: { items: [intent()] } });
  updateIntent.mockResolvedValue({ ok: true, data: { ok: true } });
});

describe('IntentDetailClient', () => {
  it('แสดงชื่อ + readiness + tab keywords/responses', async () => {
    render(<IntentDetailClient intentId="i1" />);
    expect(await screen.findByText('เวลาทำการ')).toBeInTheDocument();
    expect(screen.getByText('ตอบเรื่องเวลา')).toBeInTheDocument();
    expect(screen.getByText('พร้อม')).toBeInTheDocument();
    expect(screen.getByText('กี่โมง')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('tab', { name: /คำตอบ/ }));
    expect(await screen.findByText('เปิด 08:30')).toBeInTheDocument();
  });

  it('หมวดไม่พร้อมแสดงเหตุผล', async () => {
    listIntents.mockResolvedValue({ ok: true, data: { items: [intent({ keywords: [] })] } });
    render(<IntentDetailClient intentId="i1" />);
    expect(await screen.findByText('ไม่พร้อม (ยังไม่มี keyword)')).toBeInTheDocument();
  });

  it('ไม่มีหมวดแสดงข้อความไทย', async () => {
    listIntents.mockResolvedValue({ ok: true, data: { items: [] } });
    render(<IntentDetailClient intentId="nope" />);
    expect(await screen.findByText('ไม่พบหมวดนี้')).toBeInTheDocument();
  });

  it('toggle ปิดยิง update isActive=false', async () => {
    listIntents
      .mockResolvedValueOnce({ ok: true, data: { items: [intent()] } })
      .mockResolvedValueOnce({ ok: true, data: { items: [intent({ isActive: false })] } });
    render(<IntentDetailClient intentId="i1" />);
    await screen.findByText('เวลาทำการ');

    await userEvent.setup().click(screen.getByRole('button', { name: 'ปิด เวลาทำการ' }));
    await waitFor(() => expect(updateIntent).toHaveBeenCalled());
    const payload = updateIntent.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({ isActive: false, name: 'เวลาทำการ' });
  });
});
