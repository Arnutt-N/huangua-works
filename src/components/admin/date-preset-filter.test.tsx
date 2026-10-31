// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatePresetFilter } from './date-preset-filter';
import { STANDARD_DATE_PRESETS } from '@/lib/date-range';

afterEach(() => {
  cleanup();
});

describe('DatePresetFilter (Tranche F)', () => {
  it('แสดงปุ่ม preset มาตรฐานครบถ้วน (วันนี้, 7 วัน, 30 วัน, ปีงบประมาณนี้, กำหนดเอง)', () => {
    render(
      <DatePresetFilter
        preset={null}
        customStart=""
        customEnd=""
        onPresetChange={vi.fn()}
        onCustomStartChange={vi.fn()}
        onCustomEndChange={vi.fn()}
      />,
    );

    STANDARD_DATE_PRESETS.forEach((opt) => {
      expect(screen.getByRole('button', { name: opt.label })).toBeInTheDocument();
    });
  });

  it('กดปุ่ม preset แล้วเรียก onPresetChange ด้วย key ที่ถูกต้อง', async () => {
    const user = userEvent.setup();
    const handlePresetChange = vi.fn();

    render(
      <DatePresetFilter
        preset={null}
        customStart=""
        customEnd=""
        onPresetChange={handlePresetChange}
        onCustomStartChange={vi.fn()}
        onCustomEndChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '7 วัน' }));
    expect(handlePresetChange).toHaveBeenCalledWith('7d');

    await user.click(screen.getByRole('button', { name: 'ปีงบประมาณนี้' }));
    expect(handlePresetChange).toHaveBeenCalledWith('fiscal');
  });

  it('ปุ่มที่ถูกเลือก (active) มี aria-pressed=true', () => {
    render(
      <DatePresetFilter
        preset="30d"
        customStart=""
        customEnd=""
        onPresetChange={vi.fn()}
        onCustomStartChange={vi.fn()}
        onCustomEndChange={vi.fn()}
      />,
    );

    const btn30d = screen.getByRole('button', { name: '30 วัน' });
    expect(btn30d).toHaveAttribute('aria-pressed', 'true');

    const btn7d = screen.getByRole('button', { name: '7 วัน' });
    expect(btn7d).toHaveAttribute('aria-pressed', 'false');
  });

  it('เมื่อ preset เป็น custom จะแสดง ThaiDatePicker สองช่อง (ตั้งแต่วันที่ และ ถึงวันที่)', () => {
    render(
      <DatePresetFilter
        preset="custom"
        customStart="2026-10-01"
        customEnd="2026-10-15"
        onPresetChange={vi.fn()}
        onCustomStartChange={vi.fn()}
        onCustomEndChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'ตั้งแต่วันที่' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ถึงวันที่' })).toBeInTheDocument();
  });

  it('เมื่อ preset ไม่ใช่ custom จะไม่แสดง ThaiDatePicker', () => {
    render(
      <DatePresetFilter
        preset="7d"
        customStart=""
        customEnd=""
        onPresetChange={vi.fn()}
        onCustomStartChange={vi.fn()}
        onCustomEndChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'ตั้งแต่วันที่' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ถึงวันที่' })).not.toBeInTheDocument();
  });

  it('แสดงปุ่มล้างตัวกรองเมื่อ showClear=true และเรียก onClear เมื่อกด', async () => {
    const user = userEvent.setup();
    const handleClear = vi.fn();

    render(
      <DatePresetFilter
        preset="30d"
        customStart=""
        customEnd=""
        onPresetChange={vi.fn()}
        onCustomStartChange={vi.fn()}
        onCustomEndChange={vi.fn()}
        showClear={true}
        onClear={handleClear}
      />,
    );

    const clearBtn = screen.getByRole('button', { name: /ล้างวันที่/ });
    expect(clearBtn).toBeInTheDocument();
    await user.click(clearBtn);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});
