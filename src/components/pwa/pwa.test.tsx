// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import { OfflineIndicator } from './offline-indicator';
import { PwaRegister } from './pwa-register';

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('ไม่แสดงแถบเตือนเมื่อเชื่อมต่ออินเทอร์เน็ตปกติ', () => {
    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('แสดงแถบเตือนเมื่อเบราว์เซอร์อยู่ในสถานะออฟไลน์', () => {
    vi.stubGlobal('navigator', { onLine: false });
    render(<OfflineIndicator />);

    const alert = screen.getByRole('status');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('โหมดออฟไลน์');
  });

  it('ตอบสนองต่อ offline และ online event', () => {
    render(<OfflineIndicator />);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByRole('status').textContent).toContain('โหมดออฟไลน์');

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByRole('status').textContent).toContain('เชื่อมต่ออินเทอร์เน็ตเรียบร้อยแล้ว');
  });
});

describe('PwaRegister', () => {
  it('ลงทะเบียน service worker เมื่อเบราว์เซอร์รองรับ', () => {
    const registerMock = vi.fn().mockResolvedValue({ onupdatefound: null });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: registerMock,
        controller: null,
      },
    });

    render(<PwaRegister />);
    expect(registerMock).toHaveBeenCalledWith('/sw.js');
  });
});
