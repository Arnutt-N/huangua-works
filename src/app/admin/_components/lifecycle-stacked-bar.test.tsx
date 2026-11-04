// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LifecycleStackedBar } from './lifecycle-stacked-bar';
import type { StatusBreakdownItem } from './admin-dashboard-types';

afterEach(() => {
  cleanup();
});

// § ผลรวมรายสถานะ = 274 (ตรงกับข้อมูลที่ทำให้แถบเกิน 100% เมื่อใช้ totalReceived รายวัน = 1)
const ITEMS: StatusBreakdownItem[] = [
  { status: 'pending', count: 3, label: 'รอรับเรื่อง' },
  { status: 'received', count: 1, label: 'รับเรื่อง' },
  { status: 'reviewing', count: 21, label: 'ตรวจสอบ' },
  { status: 'awaiting_budget', count: 4, label: 'รออนุมัติงบประมาณ' },
  { status: 'in_progress', count: 10, label: 'กำลังดำเนินการ' },
  { status: 'done', count: 235, label: 'เสร็จสิ้น' },
];

describe('LifecycleStackedBar', () => {
  it('คิดสัดส่วนจากผลรวมของรายสถานะ ไม่เกิน 100% และแถบไม่ล้นกรอบ', () => {
    const { container } = render(<LifecycleStackedBar statusItems={ITEMS} />);

    // 235 / 274 = 85.8%
    expect(screen.getByText('85.8%')).toBeInTheDocument();

    const widths = Array.from(
      container.querySelectorAll<HTMLElement>('[role="img"] > div'),
    ).map((el) => Number.parseFloat(el.style.width));
    const sum = widths.reduce((a, b) => a + b, 0);
    expect(sum).toBeLessThanOrEqual(100.0001);
  });

  it('แสดงข้อความว่างเมื่อไม่มีข้อมูล', () => {
    render(<LifecycleStackedBar statusItems={[]} />);
    expect(screen.getByText('ยังไม่มีข้อมูลในวงจรขั้นตอน')).toBeInTheDocument();
  });
});
