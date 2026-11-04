// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusDonutChart } from './status-donut-chart';
import type { StatusBreakdownItem } from './admin-dashboard-types';

afterEach(() => {
  cleanup();
});

// § ข้อมูลจริงจากหน้าแดชบอร์ดที่เคยทำให้โดนัทเป็นวงเขียวทึบ:
// ผลรวมรายสถานะ = 274 แต่ค่า totalReceived (snapshot รายวัน) = 1
const ITEMS: StatusBreakdownItem[] = [
  { status: 'pending', count: 3, label: 'รอรับเรื่อง' },
  { status: 'received', count: 1, label: 'รับเรื่อง' },
  { status: 'reviewing', count: 21, label: 'ตรวจสอบ' },
  { status: 'awaiting_budget', count: 4, label: 'รออนุมัติงบประมาณ' },
  { status: 'in_progress', count: 10, label: 'กำลังดำเนินการ' },
  { status: 'done', count: 235, label: 'เสร็จสิ้น' },
];

function dashLengths(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll('svg circle[role="button"]')).map((c) => {
    const first = (c.getAttribute('stroke-dasharray') ?? '0').split(' ')[0] ?? '0';
    return Number.parseFloat(first);
  });
}

describe('StatusDonutChart', () => {
  it('ใช้ผลรวมของรายสถานะเป็นตัวหาร ไม่ให้ชิ้นโดนัททับกันจนเป็นวงเดียว', () => {
    const { container } = render(<StatusDonutChart items={ITEMS} />);

    const lengths = dashLengths(container);
    expect(lengths).toHaveLength(ITEMS.length);

    const circumference = 2 * Math.PI * 64;
    const sum = lengths.reduce((a, b) => a + b, 0);
    // ผลรวมความยาวชิ้นต้องไม่เกินเส้นรอบวง (ยอมให้คลาดจากการปัดทศนิยม)
    expect(sum).toBeLessThanOrEqual(circumference + 0.1);
    // ไม่มีชิ้นใดยาวเต็มวง
    for (const len of lengths) expect(len).toBeLessThan(circumference);
  });

  it('แสดงยอดรวมที่กึ่งกลางเท่ากับผลรวมของรายสถานะ', () => {
    render(<StatusDonutChart items={ITEMS} />);
    expect(screen.getByText('274')).toBeInTheDocument();
    expect(screen.getByText('เรื่องทั้งหมด')).toBeInTheDocument();
  });

  it('แสดงข้อความว่างเมื่อไม่มีข้อมูลสถานะ', () => {
    render(<StatusDonutChart items={[]} />);
    expect(screen.getByText('ยังไม่มีข้อมูลสถานะเรื่องร้องเรียน')).toBeInTheDocument();
  });

  it('ป้ายสถานะชื่อยาวไม่ถูกจำกัดความกว้างจนล้นทับแถบสัดส่วน', () => {
    const { container } = render(<StatusDonutChart items={ITEMS} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('@container');
    expect(root.innerHTML).not.toContain('w-28');
    expect(root.innerHTML).not.toContain('sm:grid-cols-12');
    const badge = screen.getByText('รออนุมัติงบประมาณ');
    expect(badge.className).toContain('shrink-0');
    expect(badge.closest('a')?.className).toContain('flex-wrap');
  });
});
