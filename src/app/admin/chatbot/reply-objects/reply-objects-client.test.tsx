// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplyObject } from '@/app/admin/_lib/admin-api';
import { ReplyObjectsClient } from './reply-objects-client';

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
  it('การ์ดแสดงรหัส $$object_id + badge type + alt text', async () => {
    render(<ReplyObjectsClient />);
    expect(await screen.findByText('$$welcome_flex')).toBeInTheDocument();
    expect(screen.getByText('flex')).toBeInTheDocument();
    expect(screen.getByText('ยินดีต้อนรับ')).toBeInTheDocument();
  });

  it('payload text แสดงสรุป 1 บรรทัด ไม่ dump JSON เต็ม', async () => {
    listReplyObjects.mockResolvedValue({
      ok: true,
      data: { items: [item({ objectId: 'hello', objectType: 'text', payload: { text: 'สวัสดีครับ' } })] },
    });
    render(<ReplyObjectsClient />);
    expect(await screen.findByText('$$hello')).toBeInTheDocument();
    expect(screen.getByText('สวัสดีครับ')).toBeInTheDocument();
  });

  it('quick reply แสดง badge', async () => {
    listReplyObjects.mockResolvedValue({
      ok: true,
      data: {
        items: [
          item({
            payload: {
              text: 'เลือกเมนู',
              quickReply: { items: [{ type: 'action', action: { type: 'message', label: 'a', text: 'a' } }] },
            },
          }),
        ],
      },
    });
    render(<ReplyObjectsClient />);
    expect(await screen.findByText('quick reply')).toBeInTheDocument();
  });

  it('ห้องว่างแสดง empty state ไทย', async () => {
    listReplyObjects.mockResolvedValue({ ok: true, data: { items: [] } });
    render(<ReplyObjectsClient />);
    expect(await screen.findByText('ยังไม่มี reply object')).toBeInTheDocument();
  });

  it('payload ผิด type ถูก block พร้อมข้อความไทย ไม่ยิง API', async () => {
    const user = userEvent.setup();
    listReplyObjects.mockResolvedValue({ ok: true, data: { items: [] } });
    render(<ReplyObjectsClient />);
    await screen.findByText('ยังไม่มี reply object');

    await user.click(screen.getByRole('button', { name: 'สร้าง' }));
    await user.type(screen.getByLabelText('Object ID (ใช้ใน $object_id)'), 'bad_text');
    // § userEvent.type แปล {..} เป็น keyboard tag — paste ใส่ค่า JSON ตรง ไม่ผ่าน keyboard parser
    const payloadBox = screen.getByLabelText('Payload (JSON)');
    await user.click(payloadBox);
    await user.paste('{"nope":1}');
    await user.click(screen.getByRole('button', { name: 'บันทึก' }));

    expect(createReplyObject).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('ลบแล้ว reload ลิสต์', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    listReplyObjects
      .mockResolvedValueOnce({ ok: true, data: { items: [item()] } })
      .mockResolvedValueOnce({ ok: true, data: { items: [] } });
    deleteReplyObject.mockResolvedValue({ ok: true, data: { ok: true } });
    render(<ReplyObjectsClient />);
    await screen.findByText('$$welcome_flex');

    await user.click(screen.getByRole('button', { name: 'ลบ welcome_flex' }));

    await waitFor(() => expect(deleteReplyObject).toHaveBeenCalledWith('r1'));
    expect(await screen.findByText('ยังไม่มี reply object')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
