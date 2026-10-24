// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult, IntentItem } from '@/app/admin/_lib/admin-api';
import { IntentSection } from './intent-section';
vi.setConfig({ testTimeout: 30_000 });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const listIntents = vi.fn();
const createIntent = vi.fn();
const updateIntent = vi.fn();
const deleteIntent = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listIntents: (...args: unknown[]) => listIntents(...args),
    createIntent: (...args: unknown[]) => createIntent(...args),
    updateIntent: (...args: unknown[]) => updateIntent(...args),
    deleteIntent: (...args: unknown[]) => deleteIntent(...args),
  },
}));

vi.mock('@/app/admin/_lib/use-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/admin/_lib/use-resource')>();
  return {
    ...actual,
    useResource: (opts: { load: () => Promise<ApiResult<unknown>> }) =>
      actual.useResource({ ...opts, debounceMs: 0 }),
  };
});

function intent(over: Partial<IntentItem> = {}): IntentItem {
  return {
    id: 'i1',
    name: 'เวลาทำการ',
    description: null,
    isActive: true,
    keywords: [{ id: 'k1', keyword: 'กี่โมง', matchType: 'contains' }],
    responses: [
      { id: 'r1', replyType: 'text', textContent: 'เปิด 08:30-16:30', replyObjectId: null, displayOrder: 0 },
    ],
    ...over,
  };
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  listIntents.mockReset();
  createIntent.mockReset();
  updateIntent.mockReset();
  deleteIntent.mockReset();
});

describe('IntentSection หมวดเจตนา JSK', () => {
  it('ลิสต์แสดงชื่อ keyword + สวิตช์สถานะ + ลิงก์ดู', async () => {
    listIntents.mockResolvedValue({ ok: true, data: { items: [intent()] } });
    render(<IntentSection />);

    expect(await screen.findByText('เวลาทำการ')).toBeInTheDocument();
    expect(screen.getByText('กี่โมง')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'ปิด เวลาทำการ' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('link', { name: 'ดู เวลาทำการ' })).toHaveAttribute(
      'href',
      '/admin/chatbot/auto-replies/i1',
    );
  });

  it('toggle ปิดยิง update isActive=false + reload', async () => {
    updateIntent.mockResolvedValue({ ok: true, data: { ok: true } });
    listIntents
      .mockResolvedValueOnce({ ok: true, data: { items: [intent()] } })
      .mockResolvedValueOnce({ ok: true, data: { items: [intent({ isActive: false })] } });
    render(<IntentSection />);
    await screen.findByText('เวลาทำการ');

    await userEvent.setup().click(screen.getByRole('switch', { name: 'ปิด เวลาทำการ' }));
    await waitFor(() => expect(updateIntent).toHaveBeenCalled());
    const [id, payload] = updateIntent.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe('i1');
    expect(payload).toMatchObject({ isActive: false });
    expect(payload).not.toHaveProperty('keywords');
    expect(payload).not.toHaveProperty('responses');
  });

  it('หมวดไม่มี keyword — สวิตช์ยังโชว์สถานะพร้อมมี title เตือนเหตุผล', async () => {
    listIntents.mockResolvedValue({ ok: true, data: { items: [intent({ keywords: [] })] } });
    render(<IntentSection />);

    const sw = await screen.findByRole('switch');
    expect(sw).toHaveAttribute('title', expect.stringContaining('ยังไม่มี keyword'));
  });

  it('ห้องว่างแสดง empty state ไทย', async () => {
    listIntents.mockResolvedValue({ ok: true, data: { items: [] } });
    render(<IntentSection />);

    expect(await screen.findByText(/ยังไม่มีหมวดเจตนา/)).toBeInTheDocument();
  });

  it('สร้างหมวดใหม่แล้ว reload', async () => {
    const user = userEvent.setup();
    listIntents
      .mockResolvedValueOnce({ ok: true, data: { items: [] } })
      .mockResolvedValueOnce({ ok: true, data: { items: [intent()] } });
    createIntent.mockResolvedValue({ ok: true });
    render(<IntentSection />);
    await screen.findByText(/ยังไม่มีหมวดเจตนา/);

    await user.click(screen.getByRole('button', { name: 'New Category' }));
    await user.type(screen.getByLabelText('ชื่อหมวด *'), 'เวลาทำการ');
    await user.type(screen.getByLabelText('keyword ที่ 1'), 'กี่โมง');
    await user.type(screen.getByLabelText('ข้อความคำตอบที่ 1'), 'เปิด 08:30-16:30');
    await user.click(screen.getByRole('button', { name: 'สร้างอย่างเดียว' }));

    await waitFor(() => expect(createIntent).toHaveBeenCalled());
    expect(await screen.findByText('เวลาทำการ')).toBeInTheDocument();
  });

  it('validation บล็อกเมื่อไม่มี keyword', async () => {
    const user = userEvent.setup();
    listIntents.mockResolvedValue({ ok: true, data: { items: [] } });
    render(<IntentSection />);
    await screen.findByText(/ยังไม่มีหมวดเจตนา/);

    await user.click(screen.getByRole('button', { name: 'New Category' }));
    await user.type(screen.getByLabelText('ชื่อหมวด *'), 'เวลาทำการ');
    await user.type(screen.getByLabelText('ข้อความคำตอบที่ 1'), 'เปิด 08:30-16:30');
    await user.click(screen.getByRole('button', { name: 'สร้างอย่างเดียว' }));

    await waitFor(() => expect(createIntent).not.toHaveBeenCalled());
  });

  it('เปิดแก้ไขคง matchType ราย keyword และ reply_object ไว้ครบตอนบันทึก', async () => {
    const user = userEvent.setup();
    const existing = intent({
      keywords: [
        { id: 'k1', keyword: 'เวลา', matchType: 'starts_with' },
        { id: 'k2', keyword: 'กี่โมง', matchType: 'contains' },
      ],
      responses: [
        { id: 'r1', replyType: 'text', textContent: 'เปิด 08:30-16:30', replyObjectId: null, displayOrder: 0 },
        { id: 'r2', replyType: 'reply_object', textContent: null, replyObjectId: 'obj-1', displayOrder: 1 },
      ],
    });
    listIntents.mockResolvedValue({ ok: true, data: { items: [existing] } });
    updateIntent.mockResolvedValue({ ok: true });
    render(<IntentSection />);
    await screen.findByText('เวลาทำการ');

    await user.click(screen.getByRole('button', { name: 'แก้ไข เวลาทำการ' }));
    expect(screen.getByLabelText('keyword ที่ 1')).toHaveValue('เวลา');
    expect(screen.getByLabelText('วิธีจับคู่ keyword ที่ 1')).toHaveValue('starts_with');
    expect(screen.getByLabelText('keyword ที่ 2')).toHaveValue('กี่โมง');
    expect(screen.getByLabelText('ชนิดคำตอบที่ 2')).toHaveValue('reply_object');
    expect(screen.getByLabelText('reply object id คำตอบที่ 2')).toHaveValue('obj-1');

    await user.click(screen.getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(updateIntent).toHaveBeenCalled());
    const payload = updateIntent.mock.calls[0]?.[1];
    expect(payload).toEqual({
      name: 'เวลาทำการ',
      description: null,
      isActive: true,
      keywords: [
        { keyword: 'เวลา', matchType: 'starts_with' },
        { keyword: 'กี่โมง', matchType: 'contains' },
      ],
      responses: [
        { replyType: 'text', textContent: 'เปิด 08:30-16:30', replyObjectId: null, displayOrder: 0 },
        { replyType: 'reply_object', textContent: null, replyObjectId: 'obj-1', displayOrder: 1 },
      ],
    });
  });
});
