// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThaiDatePicker } from './thai-date-picker';

afterEach(() => {
  cleanup();
});

describe('ThaiDatePicker', () => {
  it('แสดงค่าเริ่มต้นและเปิดปฏิทิน พ.ศ. ใน document.body (Portal) ได้', () => {
    const onChange = vi.fn();
    render(
      <div className="overflow-hidden">
        <ThaiDatePicker label="ตั้งแต่วันที่" value="2026-10-15" onChange={onChange} />
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'ตั้งแต่วันที่' });
    expect(trigger).toHaveTextContent('15 ต.ค. 2569');

    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'ปฏิทิน ตั้งแต่วันที่' });
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveTextContent('ตุลาคม 2569');

    fireEvent.click(screen.getByRole('button', { name: '20' }));
    expect(onChange).toHaveBeenCalledWith('2026-10-20');
  });

  it('แสดงปุ่มล้างค่า (X) แบบแยกชัดเจน (32px hit box) และกดล้างค่าได้', () => {
    const onChange = vi.fn();
    render(<ThaiDatePicker label="ถึงวันที่" value="2026-10-23" onChange={onChange} />);

    const clearBtn = screen.getByRole('button', { name: 'ล้างถึงวันที่' });
    expect(clearBtn).toHaveClass('h-8', 'w-8');

    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('เลื่อนเปลี่ยนเดือนและกดปุ่ม Escape เพื่อปิดปฏิทินได้', () => {
    const onChange = vi.fn();
    render(<ThaiDatePicker label="ตั้งแต่วันที่" value="2026-01-10" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'ตั้งแต่วันที่' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('มกราคม 2569');

    fireEvent.click(screen.getByRole('button', { name: 'เดือนก่อนหน้า' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('ธันวาคม 2568');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
