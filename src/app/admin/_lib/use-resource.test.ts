// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult } from './admin-api';
import { useResource } from './use-resource';

interface Row {
  id: string;
  name: string;
}
interface Page {
  items: Row[];
  total: number;
}

/** in-memory adapter — seam ที่สองของ hook (ของจริงคือ adminApi ที่ยิง fetch) */
function makeAdapter(seed: Page) {
  const state = { page: seed };
  let manual = false;
  const resolvers: Array<(r: ApiResult<Page>) => void> = [];
  const load = vi.fn((query: string): Promise<ApiResult<Page>> => {
    if (!manual) return Promise.resolve({ ok: true, data: state.page });
    return new Promise((resolve) => {
      resolvers.push(resolve);
    });
  });
  return {
    load,
    state,
    useManual() {
      manual = true;
    },
    resolveAt(index: number, result: ApiResult<Page>) {
      resolvers[index]!(result);
    },
  };
}

async function flush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useResource', () => {
  it('โหลดครั้งเดียวตอน mount แล้วหยุดสถานะโหลด (ไม่ยิง fetch ซ้ำ)', async () => {
    const adapter = makeAdapter({ items: [{ id: '1', name: 'a' }], total: 1 });
    const { result } = renderHook(() => useResource({ load: adapter.load }));

    await flush(0);

    expect(adapter.load).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.total).toBe(1);
  });

  it('ค้นหากันสะบัด 300ms — mount โหลดทันที แต่พิมพ์แล้วรอครบเวลา', async () => {
    const adapter = makeAdapter({ items: [], total: 0 });
    const { rerender } = renderHook(
      ({ q }: { q: string }) => useResource({ load: adapter.load, query: q, debounceMs: 300 }),
      { initialProps: { q: '' } },
    );
    await flush(0);
    expect(adapter.load).toHaveBeenCalledTimes(1);
    expect(adapter.load).toHaveBeenLastCalledWith('');

    rerender({ q: 'ว' });
    await flush(299);
    expect(adapter.load).toHaveBeenCalledTimes(1);

    await flush(1);
    expect(adapter.load).toHaveBeenCalledTimes(2);
    expect(adapter.load).toHaveBeenLastCalledWith('ว');
  });

  it('ทิ้ง response ของ request เก่าที่มาช้ากว่า', async () => {
    const adapter = makeAdapter({ items: [{ id: '0', name: 'seed' }], total: 1 });
    adapter.useManual();
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useResource({ load: adapter.load, query: q, debounceMs: 300 }),
      { initialProps: { q: '' } },
    );
    await flush(0); // call #0 ยังค้าง
    rerender({ q: 'ใหม่' });
    await flush(300); // call #1 ยังค้าง
    expect(adapter.load).toHaveBeenCalledTimes(2);

    await act(async () => {
      adapter.resolveAt(1, { ok: true, data: { items: [{ id: '2', name: 'ใหม่' }], total: 1 } });
    });
    expect(result.current.data?.items[0]?.id).toBe('2');

    // response ของ request เก่ามาช้า → ต้องไม่แทนที่ค่าใหม่
    await act(async () => {
      adapter.resolveAt(0, { ok: true, data: { items: [{ id: '1', name: 'เก่า' }], total: 1 } });
    });
    expect(result.current.data?.items[0]?.id).toBe('2');
  });

  it('mutate สำเร็จ: แจ้งผล + โหลดใหม่อัตโนมัติ + ข้อความหายใน 4s', async () => {
    const adapter = makeAdapter({ items: [], total: 0 });
    const { result } = renderHook(() => useResource({ load: adapter.load }));
    await flush(0);

    let ok = false;
    await act(async () => {
      ok = await result.current.mutate(
        async () => ({ ok: true as const, data: { ok: true } }),
        'บันทึกสำเร็จ',
      );
    });

    expect(ok).toBe(true);
    expect(result.current.feedback).toEqual({ type: 'success', msg: 'บันทึกสำเร็จ' });
    expect(adapter.load).toHaveBeenCalledTimes(2); // reload หลัง mutate
    expect(result.current.loading).toBe(false);

    await flush(4000);
    expect(result.current.feedback).toBeNull();
  });

  it('mutate ล้มเหลว: แจ้ง error จาก envelope และไม่โหลดใหม่ (และ opts.reload:false ใช้ได้)', async () => {
    const adapter = makeAdapter({ items: [], total: 0 });
    const { result } = renderHook(() => useResource({ load: adapter.load }));
    await flush(0);

    let ok = true;
    await act(async () => {
      ok = await result.current.mutate(
        async () => ({ ok: false as const, error: 'ไม่พบ FAQ', status: 404 }),
        'ไม่ควรขึ้น',
      );
    });

    expect(ok).toBe(false);
    expect(result.current.feedback).toEqual({ type: 'error', msg: 'ไม่พบ FAQ' });
    expect(adapter.load).toHaveBeenCalledTimes(1); // ไม่ reload

    await act(async () => {
      await result.current.mutate(
        async () => ({ ok: true as const, data: { ok: true } }),
        'อีกครั้ง',
        { reload: false },
      );
    });
    expect(adapter.load).toHaveBeenCalledTimes(1); // reload:false ไม่ยิงเพิ่ม
  });

  it('notify ซ้ำ: timer ของข้อความเก่าถูกเคลียร์ ข้อความใหม่ไม่โดนลบเร็ว', async () => {
    const adapter = makeAdapter({ items: [], total: 0 });
    const { result } = renderHook(() => useResource({ load: adapter.load }));
    await flush(0);

    act(() => result.current.notify('success', 'แรก'));
    await flush(3000);
    act(() => result.current.notify('error', 'สอง'));
    await flush(2000); // เกิน 4000ms ของ "แรก" แล้ว
    expect(result.current.feedback).toEqual({ type: 'error', msg: 'สอง' });

    await flush(2001); // ครบ 4000ms ของ "สอง"
    expect(result.current.feedback).toBeNull();
  });

  it('intervalMs: โหลดซ้ำทุก 30s โดย loadingOnReload:false ไม่ปิดข้อมูลเดิม', async () => {
    const adapter = makeAdapter({ items: [{ id: '1', name: 'a' }], total: 1 });
    const { result } = renderHook(() =>
      useResource({ load: adapter.load, intervalMs: 30_000, loadingOnReload: false }),
    );
    await flush(0);
    expect(adapter.load).toHaveBeenCalledTimes(1);

    await flush(30_000);
    expect(adapter.load).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('โหลดล้มเหลว: แจ้งผล error ตาม envelope และหยุดสถานะโหลด', async () => {
    const load = vi.fn(
      async (): Promise<ApiResult<Page>> => ({ ok: false, error: 'สิทธิ์ไม่เพียงพอ', status: 403 }),
    );
    const { result } = renderHook(() => useResource({ load }));
    await flush(0);

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.feedback).toEqual({ type: 'error', msg: 'สิทธิ์ไม่เพียงพอ' });
  });

  it('reload ค้างแล้ว query เปลี่ยน: ผลของ query เก่าไม่ทับข้อมูลใหม่', async () => {
    const adapter = makeAdapter({ items: [{ id: '0', name: 'seed' }], total: 1 });
    adapter.useManual();
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useResource({ load: adapter.load, query: q, debounceMs: 300 }),
      { initialProps: { q: 'A' } },
    );
    await flush(0);
    await act(async () => {
      void result.current.reload(); // reload(A) ค้าง — ยังไม่ resolve
    });
    rerender({ q: 'B' });
    await flush(100); // ก่อน debounce 300ms ของ B
    expect(adapter.load).toHaveBeenLastCalledWith('A');

    await flush(200); // ครบ debounce → request B
    await act(async () => {
      adapter.resolveAt(2, { ok: true, data: { items: [{ id: 'B', name: 'ใหม่' }], total: 1 } });
    });
    expect(result.current.data?.items[0]?.id).toBe('B');

    await act(async () => {
      adapter.resolveAt(1, { ok: true, data: { items: [{ id: 'A', name: 'เก่า' }], total: 1 } });
    });
    expect(result.current.data?.items[0]?.id).toBe('B'); // ผล A มาทีหลังต้องไม่ทับ
  });

  it('response ของ reload หลัง unmount ไม่ notify และไม่ตั้ง timer', async () => {
    const adapter = makeAdapter({ items: [], total: 0 });
    adapter.useManual();
    const { result, unmount } = renderHook(() => useResource({ load: adapter.load }));
    await flush(0);
    await act(async () => {
      adapter.resolveAt(0, { ok: true, data: { items: [], total: 0 } });
    });

    await act(async () => {
      void result.current.reload();
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => {
      adapter.resolveAt(1, { ok: false, error: 'มาสาย', status: 500 });
    });
    expect(vi.getTimerCount()).toBe(0); // ไม่มี notify timer หลังถอด component
  });

  it('unmount แล้วไม่มี timer แจ้งผลค้าง (ไม่มี setState หลังถอด component)', async () => {
    const adapter = makeAdapter({ items: [], total: 0 });
    const { result, unmount } = renderHook(() => useResource({ load: adapter.load }));
    await flush(0);

    act(() => result.current.notify('success', 'บันทึกแล้ว'));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('setData แก้ค่าฝั่ง client ได้ (optimistic) และ reload ดันค่าจริงกลับมา', async () => {
    const adapter = makeAdapter({ items: [{ id: '1', name: 'เดิม' }], total: 1 });
    const { result } = renderHook(() => useResource({ load: adapter.load }));
    await flush(0);

    act(() =>
      result.current.setData((prev) =>
        prev ? { ...prev, items: [{ id: '1', name: 'optimistic' }] } : prev,
      ),
    );
    expect(result.current.data?.items[0]?.name).toBe('optimistic');

    adapter.state.page = { items: [{ id: '1', name: 'จากเซิร์ฟเวอร์' }], total: 1 };
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data?.items[0]?.name).toBe('จากเซิร์ฟเวอร์');
  });
});
