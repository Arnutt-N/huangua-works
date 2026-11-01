// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import { KpiCard } from './kpi-card';

afterEach(() => {
  cleanup();
});

describe('KpiCard Component', () => {
  it('เรนเดอร์เป็น static div เมื่อไม่ได้ส่ง href', () => {
    const { container } = render(
      <KpiCard
        label="เวลาดำเนินการเฉลี่ย"
        value="3.5 วัน"
        icon={TrendingUp}
        hint="รอบ 30 วัน"
      />,
    );

    expect(screen.getByText('เวลาดำเนินการเฉลี่ย')).toBeInTheDocument();
    expect(screen.getByText('3.5 วัน')).toBeInTheDocument();
    expect(screen.getByText('รอบ 30 วัน')).toBeInTheDocument();

    // ต้องไม่มีแท็ก <a> (Link)
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.querySelector('div.glass-panel')).toBeInTheDocument();
  });

  it('เรนเดอร์เป็น Link (แท็ก a) ชี้ไปยัง URL พร้อม aria-label เมื่อส่ง href', () => {
    render(
      <KpiCard
        label="เรื่องรับทั้งหมด"
        value={150}
        icon={Activity}
        href="/admin/reports"
      />,
    );

    const link = screen.getByRole('link', {
      name: 'เรื่องรับทั้งหมด 150 คลิกเพื่อดูรายการ',
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/reports');
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('เรื่องรับทั้งหมด')).toBeInTheDocument();

    // ต้องมีคลาส focus-visible ring ตาม tokens
    expect(link).toHaveClass('focus-visible:outline-accent-strong');
  });

  it('จัดรูปแบบตัวเลขจำนวนเต็มด้วย toLocaleString (th-TH)', () => {
    render(
      <KpiCard
        label="จำนวนเงินจัดสรร"
        value={1250000}
        icon={Activity}
        href="/admin/reports"
      />,
    );

    expect(screen.getByText('1,250,000')).toBeInTheDocument();
  });

  it('เรนเดอร์ variant "danger" พร้อม styling โทนสีแดง', () => {
    render(
      <KpiCard
        label="เกินกำหนด SLA"
        value={5}
        icon={AlertTriangle}
        variant="danger"
        href="/admin/reports?overdue=1"
      />,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/admin/reports?overdue=1');
    const valueEl = screen.getByText('5');
    expect(valueEl).toHaveClass('text-danger-ink');
  });

  it('เรนเดอร์ variant "gold" พร้อม styling โทนสีทอง', () => {
    render(
      <KpiCard
        label="ปิดเรื่องสำเร็จ"
        value={98}
        icon={Activity}
        variant="gold"
      />,
    );

    expect(screen.getByText('98')).toBeInTheDocument();
    expect(screen.getByText('ปิดเรื่องสำเร็จ')).toBeInTheDocument();
  });
});
