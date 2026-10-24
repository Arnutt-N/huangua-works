// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSessionTimeout } from './use-session-timeout';

// § timing: ใช้ fake timers เลื่อนเวลา ไม่รอจริง — เร็วและไม่ flaky
vi.setConfig({ testTimeout: 30_000 });

const INACTIVITY_MS = 30 * 60 * 1000;
const WARNING_MS = 5 * 60 * 1000;

describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ยังไม่เตือนก่อนถึง 25 นาที แล้วโชว์ modal พร้อมนับถอยหลัง 5 นาที', () => {
    const onLogout = vi.fn();
    const { result } = renderHook(() => useSessionTimeout(onLogout));

    act(() => void vi.advanceTimersByTime(INACTIVITY_MS - WARNING_MS - 1000));
    expect(result.current.showWarning).toBe(false);

    // § เลื่อน 1500ms ไม่ใช่ 2000 — หยุดก่อน countdown tick แรก (ทุก 1000ms) จะได้ 300 ไม่ใช่ 299
    act(() => void vi.advanceTimersByTime(1500));
    expect(result.current.showWarning).toBe(true);
    expect(result.current.remainingSeconds).toBe(300);

    act(() => void vi.advanceTimersByTime(3000));
    expect(result.current.remainingSeconds).toBe(297);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('ครบ 30 นาทีระหว่างเตือน → เรียก onLogout', () => {
    const onLogout = vi.fn();
    renderHook(() => useSessionTimeout(onLogout));

    act(() => void vi.advanceTimersByTime(INACTIVITY_MS));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('มีการใช้งาน (mousemove) → reset ตัวนับ ไม่เตือน', () => {
    const onLogout = vi.fn();
    const { result } = renderHook(() => useSessionTimeout(onLogout));

    act(() => void vi.advanceTimersByTime(INACTIVITY_MS - WARNING_MS - 1000));
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'));
    });
    act(() => void vi.advanceTimersByTime(INACTIVITY_MS - WARNING_MS - 1000));

    expect(result.current.showWarning).toBe(false);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('ระหว่าง modal โชว์ ขยับเมาส์ไม่ reset (กันตัวเตือนหายเอง)', () => {
    const onLogout = vi.fn();
    const { result } = renderHook(() => useSessionTimeout(onLogout));

    act(() => void vi.advanceTimersByTime(INACTIVITY_MS - WARNING_MS + 1000));
    expect(result.current.showWarning).toBe(true);

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'));
    });
    expect(result.current.showWarning).toBe(true);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('extendSession ปิด modal แล้วเริ่มนับใหม่ — ไม่เรียก onLogout ก่อนครบ 30 นาทีใหม่', () => {
    const onLogout = vi.fn();
    const { result } = renderHook(() => useSessionTimeout(onLogout));

    act(() => void vi.advanceTimersByTime(INACTIVITY_MS - WARNING_MS + 1000));
    expect(result.current.showWarning).toBe(true);

    act(() => result.current.extendSession());
    expect(result.current.showWarning).toBe(false);

    act(() => void vi.advanceTimersByTime(INACTIVITY_MS - 1000));
    expect(onLogout).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(2000));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
