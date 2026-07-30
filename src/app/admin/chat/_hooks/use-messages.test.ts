// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../_lib/types';
import { useMessages } from './use-messages';

const sendReply = vi.fn();
vi.mock('../_lib/api', () => ({
  fetchConversationPage: vi.fn().mockResolvedValue(null),
  patchConversation: vi.fn().mockResolvedValue({ ok: true }),
  sendReply: (...args: unknown[]) => sendReply(...args),
}));

beforeEach(() => {
  sendReply.mockReset().mockResolvedValue({ ok: true, data: { ok: true, messageId: 'srv-1' } });
});

afterEach(cleanup);

const incoming = (over: Partial<Message>): Message => ({
  id: 'm1',
  sender: 'user',
  messageType: 'text',
  textContent: 'สวัสดี',
  createdAt: '2026-07-30T10:00:00.000Z',
  ...over,
});

describe('useMessages dedup (applyIncoming)', () => {
  it('appends a new incoming message once and dedups repeated event by id', () => {
    const { result } = renderHook(() => useMessages(vi.fn()));

    act(() => result.current.applyIncoming(incoming({ id: 'm1' })));
    act(() => result.current.applyIncoming(incoming({ id: 'm1' })));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.id).toBe('m1');
  });

  it('replaces the optimistic bubble via clientTempId instead of duplicating', async () => {
    // ให้ send ค้างอยู่ (pending) เพื่อให้ optimistic bubble ยังมี clientTempId
    sendReply.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useMessages(vi.fn()));

    await act(async () => {
      result.current.send('conv-1', 'ตอบกลับ');
    });
    expect(result.current.messages).toHaveLength(1);
    const tempId = result.current.messages[0]?.clientTempId;
    expect(tempId).toBeTruthy();
    expect(result.current.messages[0]?.status).toBe('pending');

    // SSE broadcast กลับมาพร้อม id จริง + clientTempId เดิม → แทนที่ ไม่เพิ่มแถว
    act(() =>
      result.current.applyIncoming(
        incoming({ id: 'srv-9', sender: 'admin', textContent: 'ตอบกลับ', clientTempId: tempId }),
      ),
    );

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.id).toBe('srv-9');
    expect(result.current.messages[0]?.status).toBeUndefined();
  });

  it('marks the bubble failed when sendReply rejects, then retry restores pending', async () => {
    sendReply.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useMessages(vi.fn()));

    await act(async () => {
      result.current.send('conv-1', 'จะล้มเหลว');
    });
    expect(result.current.messages[0]?.status).toBe('failed');
    expect(result.current.actionError).toBe('ส่งข้อความไม่สำเร็จ — ตรวจสอบการเชื่อมต่อ');

    const failed = result.current.messages[0] as Message;
    await act(async () => {
      result.current.retry('conv-1', failed);
    });
    // retry สำเร็จ (mock default ok) → ได้ id จริงจาก server
    expect(result.current.messages[0]?.id).toBe('srv-1');
    expect(result.current.messages[0]?.status).toBeUndefined();
    expect(sendReply).toHaveBeenCalledTimes(2);
    // idempotent: retry ใช้ clientTempId เดิม
    expect(sendReply.mock.calls[1]?.[2]).toBe(failed.clientTempId);
  });
});
