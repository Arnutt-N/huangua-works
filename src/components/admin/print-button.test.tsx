// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrintButton } from './print-button';

describe('PrintButton Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('แสดงผลปุ่มพิมพ์รายงานพร้อม Accessible Role และชื่อเริ่มต้น', () => {
    render(<PrintButton />);

    const button = screen.getByRole('button', { name: /พิมพ์รายงาน/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('print:hidden');
    expect(button).toHaveClass('min-h-touch');
  });

  it('รองรับการส่ง custom label และ custom className', () => {
    render(<PrintButton label="พิมพ์เอกสาร PMQA" className="custom-test-class" />);

    const button = screen.getByRole('button', { name: /พิมพ์เอกสาร PMQA/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('custom-test-class');
  });

  it('เรียก window.print() เมื่อถูกคลิก', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(<PrintButton />);
    const button = screen.getByRole('button', { name: /พิมพ์รายงาน/i });

    fireEvent.click(button);

    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});
