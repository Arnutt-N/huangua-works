// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplyObject } from '@/app/admin/_lib/admin-api';
import { ReplyObjectsClient } from './reply-objects-client';

vi.setConfig({ testTimeout: 30_000 });

const listReplyObjects = vi.fn();
const createReplyObject = vi.fn();
const updateReplyObject = vi.fn();
const deleteReplyObject = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listReplyObjects: (...args: unknown[]) => listReplyObjects(...args),
    createReplyObject: (...args: unknown[]) => createReplyObject(...args),
    updateReplyObject: (...args: unknown[]) => updateReplyObject(...args),
    deleteReplyObject: (...args: unknown[]) => deleteReplyObject(...args),
  },
}));

function item(over: Partial<ReplyObject> = {}): ReplyObject {
  return {
    id: 'r1',
    objectId: 'welcome_flex',
    name: 'Welcome Message 2.0',
    category: 'Marketing / Support',
    objectType: 'flex',
    payload: { type: 'bubble', body: { type: 'box' } },
    altText: 'ยินดีต้อนรับ',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

afterEach(() => cleanup());

beforeEach(() => {
  listReplyObjects.mockReset();
  createReplyObject.mockReset();
  updateReplyObject.mockReset();
  deleteReplyObject.mockReset();
  listReplyObjects.mockResolvedValue({ ok: true, data: { items: [item()] } });
});

describe('ReplyObjectsClient กริด JSK', () => {
  it('การ์ดแสดง $$object_id + name + category + badge type', async () => {
    render(<ReplyObjectsClient />);
    expect(await screen.findByText('$$welcome_flex')).toBeInTheDocument();
    expect(screen.getByText('Welcome Message 2.0')).toBeInTheDocument();
    expect(screen.getByText('Marketing / Support')).toBeInTheDocument();
    expect(screen.getByText('flex')).toBeInTheDocument();
  });

  it('name ว่างใช้ objectId แทน', async () => {
    listReplyObjects.mockResolvedValue({
      ok: true,
      data: { items: [item({ objectId: 'hello', name: null, category: null })] },
    });
    render(<ReplyObjectsClient />);
    expect(await screen.findByText('$$hello')).toBeInTheDocument();
    expect(screen.getAllByText('hello').length).toBeGreaterThan(0);
  });

  it('ห้องว่างแสดง empty state ไทย', async () => {
    listReplyObjects.mockResolvedValue({ ok: true, data: { items: [] } });
    render(<ReplyObjectsClient />);
    expect(await screen.findByText('ยังไม่มี reply object')).toBeInTheDocument();
  });

  it('ปุ่ม New Template ชี้ไปหน้า /new', async () => {
    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');
    expect(screen.getByRole('link', { name: /New Template/ })).toHaveAttribute(
      'href',
      '/admin/chatbot/reply-objects/new',
    );
  });

  it('preview แสดง "invalid flex" เมื่อ payload ว่าง', async () => {
    const user = userEvent.setup();
    listReplyObjects.mockResolvedValue({
      ok: true,
      data: { items: [item({ payload: {} })] },
    });
    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');

    await user.click(screen.getByRole('button', { name: 'แก้ไข welcome_flex' }));
    expect(await screen.findByText('invalid flex')).toBeInTheDocument();
  });

  it('uri นอก allowlist ถูกบล็อกก่อนถึง API', async () => {
    const user = userEvent.setup();
    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');

    await user.click(screen.getByRole('button', { name: 'แก้ไข welcome_flex' }));
    const payloadBox = await screen.findByLabelText('Content');
    await user.clear(payloadBox);
    await user.click(payloadBox);
    await user.paste(
      '{"type":"bubble","footer":{"contents":[{"type":"button","action":{"type":"uri","uri":"javascript:alert(1)"}}]}}',
    );
    await user.click(screen.getByRole('button', { name: 'Save Modifications' }));

    expect(updateReplyObject).not.toHaveBeenCalled();
    expect(await screen.findByText(/ลิงก์ไม่ปลอดภัยหรือไม่รองรับ/)).toBeInTheDocument();
  });

  it('quick reply เพิ่มได้สูงสุด 13 ปุ่มแล้วปุ่มเพิ่มปิด', async () => {
    const user = userEvent.setup();
    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');

    await user.click(screen.getByRole('button', { name: 'แก้ไข welcome_flex' }));
    await user.click(await screen.findByRole('checkbox', { name: /Quick reply/ }));
    expect(screen.getByText('1/13 ปุ่ม')).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /เพิ่มปุ่ม/ });
    for (let i = 0; i < 12; i += 1) {
      await user.click(addBtn);
    }
    expect(screen.getByText('13/13 ปุ่ม')).toBeInTheDocument();
    expect(addBtn).toBeDisabled();
  });

  it('ลบแล้ว reload ลิสต์', async () => {
    const user = userEvent.setup();
    listReplyObjects
      .mockResolvedValueOnce({ ok: true, data: { items: [item()] } })
      .mockResolvedValueOnce({ ok: true, data: { items: [] } });
    deleteReplyObject.mockResolvedValue({ ok: true, data: { ok: true } });
    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');

    await user.click(screen.getByRole('button', { name: 'ลบ welcome_flex' }));
    await screen.findByRole('button', { name: 'ลบ' });
    await user.click(screen.getByRole('button', { name: 'ลบ' }));

    await waitFor(() => expect(deleteReplyObject).toHaveBeenCalledWith('r1'));
    expect(await screen.findByText('ยังไม่มี reply object')).toBeInTheDocument();
  });

  it('handleToggleActive คืน error → banner แสดงข้อความเดิม', async () => {
    const user = userEvent.setup();
    updateReplyObject.mockResolvedValue({ ok: false, error: 'เซิร์ฟเวอร์ขัดข้อง', status: 500 });
    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');

    await user.click(screen.getByRole('switch', { name: 'ปิดใช้งาน welcome_flex' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('เซิร์ฟเวอร์ขัดข้อง');
    });
  });

  it('กำลัง load mutation → ปุ่ม toggle/delete disabled', async () => {
    const user = userEvent.setup();
    let resolveUpdate!: (v: unknown) => void;
    updateReplyObject.mockReturnValue(new Promise((res) => { resolveUpdate = res as never; }));
    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');

    await user.click(screen.getByRole('switch', { name: 'ปิดใช้งาน welcome_flex' }));

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'ปิดใช้งาน welcome_flex' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'ลบ welcome_flex' })).toBeDisabled();
    });
    resolveUpdate({ ok: true, data: { ok: true } });
  });

  it('handleDelete → เปิด ConfirmDialog ก่อนเรียกจริง (ไม่ใช้ window.confirm)', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    listReplyObjects
      .mockResolvedValueOnce({ ok: true, data: { items: [item()] } })
      .mockResolvedValueOnce({ ok: true, data: { items: [] } });
    deleteReplyObject.mockResolvedValue({ ok: true, data: { ok: true } });
    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');

    await user.click(screen.getByRole('button', { name: 'ลบ welcome_flex' }));

    expect(await screen.findByText('เทมเพลตนี้จะถูกลบถาวรและเรียกคืนไม่ได้')).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(deleteReplyObject).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'ลบ' }));
    await waitFor(() => expect(deleteReplyObject).toHaveBeenCalledWith('r1'));
    confirmSpy.mockRestore();
  });

  it('toggle สำเร็จ → มี success banner ไม่ใช่แค่ reload เงียบ', async () => {
    const user = userEvent.setup();
    updateReplyObject.mockResolvedValue({ ok: true, data: { ok: true } });
    listReplyObjects
      .mockResolvedValueOnce({ ok: true, data: { items: [item()] } })
      .mockResolvedValueOnce({ ok: true, data: { items: [item({ isActive: false })] } });
    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');

    await user.click(screen.getByRole('switch', { name: 'ปิดใช้งาน welcome_flex' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/เรียบร้อย/);
    });
  });

  it('handleDelete คืน error → ปิด ConfirmDialog และ banner แสดง error', async () => {
    const user = userEvent.setup();
    deleteReplyObject.mockResolvedValue({ ok: false, error: 'ไม่สามารถลบได้เนื่องจากถูกใช้งานอยู่' });
    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');

    await user.click(screen.getByRole('button', { name: 'ลบ welcome_flex' }));
    expect(await screen.findByText('เทมเพลตนี้จะถูกลบถาวรและเรียกคืนไม่ได้')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ลบ' }));
    await waitFor(() => {
      expect(deleteReplyObject).toHaveBeenCalledWith('r1');
    });

    await waitFor(() => {
      expect(screen.queryByText('เทมเพลตนี้จะถูกลบถาวรและเรียกคืนไม่ได้')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent('ไม่สามารถลบได้เนื่องจากถูกใช้งานอยู่');
  });

  it('แก้ไขและบันทึกสำเร็จ → แสดง success banner และปิด modal', async () => {
    const user = userEvent.setup();
    updateReplyObject.mockResolvedValue({ ok: true, data: { ok: true } });
    listReplyObjects
      .mockResolvedValueOnce({ ok: true, data: { items: [item()] } })
      .mockResolvedValueOnce({ ok: true, data: { items: [item({ name: 'Updated Name' })] } });

    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');

    await user.click(screen.getByRole('button', { name: 'แก้ไข welcome_flex' }));
    expect(await screen.findByText('Edit Object')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save Modifications' }));
    await waitFor(() => {
      expect(updateReplyObject).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('อัปเดต welcome_flex เรียบร้อย');
    });
    expect(screen.queryByText('Edit Object')).not.toBeInTheDocument();
  });

  it('เปิดหน้าด้วย ?created=new_tpl → แสดง success banner สร้างเรียบร้อย', async () => {
    window.history.pushState({}, '', '/admin/chatbot/reply-objects?created=welcome_flex');

    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('สร้าง welcome_flex เรียบร้อย');
    });
  });
});
