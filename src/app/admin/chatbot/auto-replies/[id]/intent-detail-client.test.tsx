// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntentItem } from '@/app/admin/_lib/admin-api';
import { IntentDetailClient } from './intent-detail-client';

const getIntent = vi.fn();
const updateIntent = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    getIntent: (...args: unknown[]) => getIntent(...args),
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
  getIntent.mockReset();
  updateIntent.mockReset();
  getIntent.mockResolvedValue({ ok: true, data: intent() });
  updateIntent.mockResolvedValue({ ok: true, data: { ok: true } });
});

describe('IntentDetailClient', () => {
  it('toggle ล้มเหลวแสดง error ไม่เงียบ', async () => {
    updateIntent.mockResolvedValue({ ok: false, error: 'เซิร์ฟเวอร์ขัดข้อง', status: 500 });
    render(<IntentDetailClient intentId="i1" />);
    await screen.findByText('เวลาทำการ');

    await userEvent.setup().click(screen.getByRole('button', { name: 'ปิด เวลาทำการ' }));
    expect(await screen.findByRole('status')).toHaveTextContent('เซิร์ฟเวอร์ขัดข้อง');
  });

  it('ห้ามลบ keyword ตัวสุดท้าย — server min(1)', async () => {
    const user = userEvent.setup();
    render(<IntentDetailClient intentId="i1" />);
    await screen.findByText('กี่โมง');

    await user.click(screen.getByRole('button', { name: 'ลบ keyword กี่โมง' }));
    expect(await screen.findByRole('status')).toHaveTextContent('ต้องเหลือ keyword อย่างน้อย 1 คำ');
    expect(updateIntent).not.toHaveBeenCalled();
  });

  it('ลบ keyword เมื่อมีมากกว่า 1 คำ — เปิด confirm dialog ก่อนลบจริง', async () => {
    const user = userEvent.setup();
    const nativeConfirm = vi.spyOn(window, 'confirm');
    getIntent.mockResolvedValue({
      ok: true,
      data: intent({
        keywords: [
          { id: 'k1', keyword: 'กี่โมง', matchType: 'contains' },
          { id: 'k2', keyword: 'เปิดกี่โมง', matchType: 'contains' },
        ],
      }),
    });
    render(<IntentDetailClient intentId="i1" />);
    await screen.findByText('เปิดกี่โมง');

    await user.click(screen.getByRole('button', { name: 'ลบ keyword เปิดกี่โมง' }));
    expect(await screen.findByText('ลบ keyword')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ลบ' }));

    await waitFor(() => expect(updateIntent).toHaveBeenCalled());
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
  });
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
    getIntent.mockResolvedValue({ ok: true, data: intent({ keywords: [] }) });
    render(<IntentDetailClient intentId="i1" />);
    expect(await screen.findByText('ไม่พร้อม (ยังไม่มี keyword)')).toBeInTheDocument();
  });

  it('ไม่มีหมวดแสดงข้อความไทย', async () => {
    getIntent.mockResolvedValue({ ok: false, error: 'ไม่พบหมวดนี้', status: 404, code: 'HTTP' });
    render(<IntentDetailClient intentId="nope" />);
    expect(await screen.findByText('ไม่พบหมวดนี้')).toBeInTheDocument();
  });

  it('toggle ปิดยิง update isActive=false', async () => {
    getIntent
      .mockResolvedValueOnce({ ok: true, data: intent() })
      .mockResolvedValueOnce({ ok: true, data: intent({ isActive: false }) });
    render(<IntentDetailClient intentId="i1" />);
    await screen.findByText('เวลาทำการ');

    await userEvent.setup().click(screen.getByRole('button', { name: 'ปิด เวลาทำการ' }));
    await waitFor(() => expect(updateIntent).toHaveBeenCalled());
    const payload = updateIntent.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({ isActive: false });
    expect(payload).not.toHaveProperty('keywords');
    expect(payload).not.toHaveProperty('responses');
  });
});
