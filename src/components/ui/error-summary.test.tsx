// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorSummary, type ErrorSummaryItem } from './error-summary';

afterEach(() => {
  cleanup();
});

describe('ErrorSummary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when errors array is empty', () => {
    const { container } = render(<ErrorSummary errors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title, description, and list items with accessibility roles', () => {
    const errors: ErrorSummaryItem[] = [
      { fieldId: 'field-name', message: 'กรุณากรอกชื่อ-นามสกุล', fieldLabel: 'ชื่อผู้ติดต่อ' },
      { fieldId: 'field-phone', message: 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก' },
    ];

    render(<ErrorSummary errors={errors} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-labelledby', 'error-summary-title');
    expect(alert).toHaveAttribute('tabindex', '-1');

    expect(screen.getByText('กรุณาตรวจสอบข้อมูลที่ต้องระบุเพิ่มเติม (2 จุด)')).toBeInTheDocument();
    expect(screen.getByText('กดเลือกรายการด้านล่างเพื่อไปยังช่องที่ต้องการแก้ไขได้ทันที')).toBeInTheDocument();

    const link1 = screen.getByRole('link', { name: 'ชื่อผู้ติดต่อ: กรุณากรอกชื่อ-นามสกุล' });
    expect(link1).toHaveAttribute('href', '#field-name');

    const link2 = screen.getByRole('link', { name: 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก' });
    expect(link2).toHaveAttribute('href', '#field-phone');
  });

  it('renders custom title and description when provided', () => {
    const errors: ErrorSummaryItem[] = [{ fieldId: 'test-field', message: 'ข้อมูลไม่ถูกต้อง' }];

    render(
      <ErrorSummary
        title="หัวข้อกำหนดเอง"
        description="คำอธิบายพิเศษ"
        errors={errors}
      />
    );

    expect(screen.getByText('หัวข้อกำหนดเอง')).toBeInTheDocument();
    expect(screen.getByText('คำอธิบายพิเศษ')).toBeInTheDocument();
  });

  it('shifts focus to container on mount when submitCount is undefined', () => {
    const errors: ErrorSummaryItem[] = [{ fieldId: 'test-field', message: 'จำเป็นต้องกรอก' }];

    render(<ErrorSummary errors={errors} />);

    const alert = screen.getByRole('alert');
    expect(document.activeElement).toBe(alert);
  });

  it('shifts focus to container only when submitCount increments', () => {
    const errors: ErrorSummaryItem[] = [{ fieldId: 'test-field', message: 'จำเป็นต้องกรอก' }];

    const { rerender } = render(<ErrorSummary errors={errors} submitCount={0} />);
    const alert = screen.getByRole('alert');
    expect(document.activeElement).not.toBe(alert);

    rerender(<ErrorSummary errors={errors} submitCount={1} />);
    expect(document.activeElement).toBe(alert);

    (document.activeElement as HTMLElement)?.blur();
    expect(document.activeElement).not.toBe(alert);

    rerender(<ErrorSummary errors={errors} submitCount={2} />);
    expect(document.activeElement).toBe(alert);
  });

  it('clicking an error link intercepts event, centers into view, and focuses target input', () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const input = document.createElement('input');
    input.id = 'target-input';
    document.body.appendChild(input);

    const errors: ErrorSummaryItem[] = [{ fieldId: 'target-input', message: 'กรุณากรอกข้อมูล' }];
    render(<ErrorSummary errors={errors} />);

    const link = screen.getByRole('link', { name: 'กรุณากรอกข้อมูล' });
    fireEvent.click(link);

    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'center' })
    );
    expect(document.activeElement).toBe(input);

    document.body.removeChild(input);
  });

  it('clicking an error link on a container focuses the first focusable child', () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const container = document.createElement('div');
    container.id = 'target-group';
    const button = document.createElement('button');
    button.textContent = 'ปุ่มตัวเลือก';
    container.appendChild(button);
    document.body.appendChild(container);

    const errors: ErrorSummaryItem[] = [{ fieldId: 'target-group', message: 'กรุณาเลือกตัวเลือก' }];
    render(<ErrorSummary errors={errors} />);

    const link = screen.getByRole('link', { name: 'กรุณาเลือกตัวเลือก' });
    fireEvent.click(link);

    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(document.activeElement).toBe(button);

    document.body.removeChild(container);
  });

  it('respects prefers-reduced-motion media query on smooth scroll', () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const input = document.createElement('input');
    input.id = 'reduced-motion-input';
    document.body.appendChild(input);

    const errors: ErrorSummaryItem[] = [{ fieldId: 'reduced-motion-input', message: 'ทดสอบการเคลื่อนไหว' }];
    render(<ErrorSummary errors={errors} />);

    const link = screen.getByRole('link', { name: 'ทดสอบการเคลื่อนไหว' });
    fireEvent.click(link);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'center',
    });

    document.body.removeChild(input);
  });
});
