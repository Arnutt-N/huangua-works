// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThaiDatePicker } from './thai-date-picker';

afterEach(() => {
  cleanup();
});

function Controlled({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <ThaiDatePicker label="วันที่" value={value} onChange={setValue} />;
}

describe('ThaiDatePicker', () => {
  it('แสดงวัน เดือน ปี พ.ศ. ที่พิมพ์ได้ และมีค่าแล้วเป็นกากบาทแทนปฏิทิน', () => {
    render(<ThaiDatePicker label="ตั้งแต่วันที่" value="2026-10-15" onChange={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'ตั้งแต่วันที่' })).toHaveValue('15');
    expect(screen.getByRole('textbox', { name: 'เดือน ตั้งแต่วันที่' })).toHaveValue('10');
    expect(screen.getByRole('textbox', { name: 'ปี พ.ศ. ตั้งแต่วันที่' })).toHaveValue('2569');
    expect(screen.getByRole('button', { name: 'ล้างตั้งแต่วันที่' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'เปิดปฏิทิน ตั้งแต่วันที่' })).not.toBeInTheDocument();
  });

  it('กดปฏิทินแล้วเลือกวัน ส่ง ISO และเปลี่ยนเป็นกากบาทวงกลมแดง', async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    await user.click(screen.getByRole('button', { name: 'เปิดปฏิทิน วันที่' }));
    const dialog = screen.getByRole('dialog', { name: 'ปฏิทิน วันที่' });
    expect(dialog.parentElement).toBe(document.body);

    await user.click(screen.getByRole('button', { name: '20' }));

    expect(screen.getByRole('textbox', { name: 'วันที่' })).toHaveValue('20');
    const clearBtn = screen.getByRole('button', { name: 'ล้างวันที่' });
    expect(clearBtn).toHaveClass('rounded-full', 'bg-danger/10');
    expect(clearBtn.parentElement).toHaveClass('h-9');
    expect(screen.queryByRole('button', { name: 'เปิดปฏิทิน วันที่' })).not.toBeInTheDocument();
  });

  it('พิมพ์ วว/ดด/ปปปป แล้วได้กากบาท กดล้างแล้วพิมพ์หรือเลือกใหม่ได้', async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    await user.type(screen.getByRole('textbox', { name: 'วันที่' }), '15');
    await user.type(screen.getByRole('textbox', { name: 'เดือน วันที่' }), '10');
    await user.type(screen.getByRole('textbox', { name: 'ปี พ.ศ. วันที่' }), '2569');

    expect(await screen.findByRole('button', { name: 'ล้างวันที่' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ล้างวันที่' }));

    expect(screen.getByRole('textbox', { name: 'วันที่' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'เปิดปฏิทิน วันที่' })).toBeInTheDocument();
  });

  it('เลื่อนเปลี่ยนเดือนและกดปุ่ม Escape เพื่อปิดปฏิทินได้', () => {
    render(<ThaiDatePicker label="ตั้งแต่วันที่" value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'เปิดปฏิทิน ตั้งแต่วันที่' }));
    const before = screen.getByRole('dialog').textContent;

    fireEvent.click(screen.getByRole('button', { name: 'เดือนก่อนหน้า' }));
    expect(screen.getByRole('dialog').textContent).not.toBe(before);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
