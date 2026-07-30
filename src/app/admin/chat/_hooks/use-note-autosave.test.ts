// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNoteAutosave } from './use-note-autosave';

const patchConversation = vi.fn();
vi.mock('../_lib/api', () => ({
  patchConversation: (...args: unknown[]) => patchConversation(...args),
}));

beforeEach(() => {
  vi.useFakeTimers();
  patchConversation.mockReset().mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useNoteAutosave', () => {
  it('debounces 800ms before saving', async () => {
    const { result } = renderHook(() => useNoteAutosave('conv-1', null));

    act(() => result.current.onChange('โทรกลับพรุ่งนี้'));
    expect(result.current.saveState).toBe('dirty');
    expect(patchConversation).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(799);
    });
    expect(patchConversation).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(patchConversation).toHaveBeenCalledExactlyOnceWith('conv-1', {
      adminNote: 'โทรกลับพรุ่งนี้',
    });
    expect(result.current.saveState).toBe('saved');
  });

  it('collapses rapid typing into one save (last value wins)', async () => {
    const { result } = renderHook(() => useNoteAutosave('conv-1', null));

    act(() => result.current.onChange('a'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    act(() => result.current.onChange('ab'));
    act(() => result.current.onChange('abc'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(patchConversation).toHaveBeenCalledExactlyOnceWith('conv-1', { adminNote: 'abc' });
  });

  it('saves empty string as null (clear note)', async () => {
    const { result } = renderHook(() => useNoteAutosave('conv-1', 'เดิม'));

    act(() => result.current.onChange(''));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(patchConversation).toHaveBeenCalledExactlyOnceWith('conv-1', { adminNote: null });
  });

  it('skips save when value returns to last-saved', async () => {
    const { result } = renderHook(() => useNoteAutosave('conv-1', 'เดิม'));

    act(() => result.current.onChange('แก้'));
    act(() => result.current.onChange('เดิม'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(patchConversation).not.toHaveBeenCalled();
    expect(result.current.saveState).toBe('idle');
  });

  it('resets and cancels pending save when switching conversation', async () => {
    const { result, rerender } = renderHook(
      ({ id, note }: { id: string; note: string | null }) => useNoteAutosave(id, note),
      { initialProps: { id: 'conv-1', note: 'ห้องแรก' } },
    );

    act(() => result.current.onChange('ยังไม่ทันเซฟ'));
    rerender({ id: 'conv-2', note: 'ห้องสอง' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(patchConversation).not.toHaveBeenCalled();
    expect(result.current.note).toBe('ห้องสอง');
    expect(result.current.saveState).toBe('idle');
  });

  it('keeps in-progress draft when initialNote refetch arrives for the same room', async () => {
    const { result, rerender } = renderHook(
      ({ id, note }: { id: string; note: string | null }) => useNoteAutosave(id, note),
      { initialProps: { id: 'conv-1', note: 'เดิม' } },
    );

    act(() => result.current.onChange('กำลังพิมพ์อยู่'));
    // refetch (เช่นหลัง transfer/reconnect) คืนค่าเก่าจาก server — ห้ามทับ draft
    rerender({ id: 'conv-1', note: 'เดิม-จาก-server' });

    expect(result.current.note).toBe('กำลังพิมพ์อยู่');
    expect(result.current.saveState).toBe('dirty');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(patchConversation).toHaveBeenCalledExactlyOnceWith('conv-1', {
      adminNote: 'กำลังพิมพ์อยู่',
    });
  });

  it('adopts new server note for the same room when there is no draft', () => {
    const { result, rerender } = renderHook(
      ({ id, note }: { id: string; note: string | null }) => useNoteAutosave(id, note),
      { initialProps: { id: 'conv-1', note: 'เดิม' } },
    );

    // แอดมินอีกคนแก้โน้ต → refetch คืนค่าใหม่ ขณะที่เราไม่มี draft ค้าง
    rerender({ id: 'conv-1', note: 'แก้โดยแอดมินอื่น' });

    expect(result.current.note).toBe('แก้โดยแอดมินอื่น');
    expect(result.current.saveState).toBe('idle');
  });

  it('reports error state when save fails', async () => {
    patchConversation.mockResolvedValue({ ok: false, error: 'x' });
    const { result } = renderHook(() => useNoteAutosave('conv-1', null));

    act(() => result.current.onChange('จะพัง'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(result.current.saveState).toBe('error');
  });
});
