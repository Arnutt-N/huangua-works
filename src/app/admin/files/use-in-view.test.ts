// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInView } from './use-in-view';

describe('useInView hook', () => {
  const originalIntersectionObserver = window.IntersectionObserver;

  afterEach(() => {
    vi.unstubAllGlobals();
    window.IntersectionObserver = originalIntersectionObserver;
  });

  it('คืนค่า true ทันทีเมื่อไม่มี IntersectionObserver (Graceful fallback ใน test/SSR)', () => {
    // ลบ IntersectionObserver ออกจาก global
    // @ts-expect-error testing missing global
    delete window.IntersectionObserver;

    const fakeRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useInView(fakeRef));

    expect(result.current).toBe(true);
  });

  it('เริ่มต้นเป็น false เมื่อมี IntersectionObserver และยังไม่ตัดเข้า viewport', () => {
    let observerCallback: (entries: IntersectionObserverEntry[]) => void = () => {};
    const observeSpy = vi.fn();
    const disconnectSpy = vi.fn();

    class MockIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin: string = '';
      readonly thresholds: readonly number[] = [];
      takeRecords = vi.fn().mockReturnValue([]);

      constructor(cb: (entries: IntersectionObserverEntry[]) => void) {
        observerCallback = cb;
      }
      observe = observeSpy;
      unobserve = vi.fn();
      disconnect = disconnectSpy;
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    const div = document.createElement('div');
    const fakeRef = { current: div };
    const { result } = renderHook(() => useInView(fakeRef));

    expect(result.current).toBe(false);
    expect(observeSpy).toHaveBeenCalledWith(div);

    // จำลองเมื่อเลื่อนเข้า Viewport (isIntersecting = true)
    act(() => {
      observerCallback([{ isIntersecting: true } as IntersectionObserverEntry]);
    });

    expect(result.current).toBe(true);
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('ไม่ observe ซ้ำและยกเลิก observer เมื่อ unmount', () => {
    const disconnectSpy = vi.fn();

    class MockIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin: string = '';
      readonly thresholds: readonly number[] = [];
      takeRecords = vi.fn().mockReturnValue([]);
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = disconnectSpy;
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    const div = document.createElement('div');
    const fakeRef = { current: div };
    const { unmount } = renderHook(() => useInView(fakeRef));

    unmount();
    expect(disconnectSpy).toHaveBeenCalled();
  });
});
