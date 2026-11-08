// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatePresetFilter } from './date-preset-filter';

afterEach(() => {
  cleanup();
});

describe('DatePresetFilter', () => {
  it('แสดงปุ่ม 7/30/90/ปีนี้ และช่องวันที่สองช่องตลอด ไม่มีปุ่มกำหนดเอง', () => {
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

    expect(screen.getByRole('button', { name: '7 วัน' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 วัน' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90 วัน' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ปีนี้' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'กำหนดเอง' })).not.toBeInTheDocument();
    expect(screen.getByText('กำหนดเอง')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'จากวันที่' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'ถึงวันที่' })).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'ปีนี้' }));
    expect(handlePresetChange).toHaveBeenCalledWith('year');
  });

  it('ปุ่มที่ถูกเลือก (active) มี aria-pressed=true และมุมโค้ง xl', () => {
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
    expect(btn30d.className).toContain('rounded-xl');

    const btn7d = screen.getByRole('button', { name: '7 วัน' });
    expect(btn7d).toHaveAttribute('aria-pressed', 'false');
  });

  it('ช่วงวันที่สลับแสดงข้อความเตือน', () => {
    render(
      <DatePresetFilter
        preset="custom"
        customStart="2026-10-20"
        customEnd="2026-10-05"
        onPresetChange={vi.fn()}
        onCustomStartChange={vi.fn()}
        onCustomEndChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
  });

  it('เลือกไว้แค่ฝั่งเดียวแสดงข้อความให้เลือกให้ครบ', () => {
    render(
      <DatePresetFilter
        preset="custom"
        customStart="2026-10-01"
        customEnd=""
        onPresetChange={vi.fn()}
        onCustomStartChange={vi.fn()}
        onCustomEndChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด');
  });

  it('แสดงปุ่มล้างช่วงวันเมื่อ showClear=true และเรียก onClear เมื่อกด', async () => {
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

    const clearBtn = screen.getByRole('button', { name: 'ล้างช่วงวัน' });
    expect(clearBtn).toBeInTheDocument();
    await user.click(clearBtn);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});
