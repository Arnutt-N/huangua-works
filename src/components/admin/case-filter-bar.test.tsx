// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaseFilterBar } from './case-filter-bar';

vi.setConfig({ testTimeout: 30_000 });

const pushMock = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/admin/reports',
  useSearchParams: () => mockSearchParams,
}));

const mockCategories = [
  { id: 'cat-1', name: 'ไฟฟ้า' },
  { id: 'cat-2', name: 'ประปา' },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
});

describe('CaseFilterBar — FLOW-03: การรักษาสถานะค้นหาและการซิงค์ searchParams', () => {
  it('อ่านค่า q จาก searchParams เมื่อเรนเดอร์ครั้งแรก', () => {
    mockSearchParams = new URLSearchParams('q=ท่อแตก');
    render(<CaseFilterBar categories={mockCategories} />);

    const searchInput = screen.getByPlaceholderText('ค้นหาเลขที่เรื่อง / หัวเรื่อง / ที่ตั้ง');
    expect(searchInput).toHaveValue('ท่อแตก');
  });

  it('ซิงค์ค่า q ใน input เมื่อ searchParams ภายนอกเปลี่ยน (เช่น กดย้อนกลับหรือเปลี่ยน query)', () => {
    mockSearchParams = new URLSearchParams('q=ไฟฟ้าดับ');
    const { rerender } = render(<CaseFilterBar categories={mockCategories} />);

    const searchInput = screen.getByPlaceholderText('ค้นหาเลขที่เรื่อง / หัวเรื่อง / ที่ตั้ง');
    expect(searchInput).toHaveValue('ไฟฟ้าดับ');

    // จำลองการเปลี่ยน searchParams จากการย้อนกลับ
    mockSearchParams = new URLSearchParams('q=ซ่อมถนน');
    rerender(<CaseFilterBar categories={mockCategories} />);

    expect(searchInput).toHaveValue('ซ่อมถนน');
  });

  it('เมื่อกดล้างตัวกรอง รีเซ็ต input search และ router.push ไปที่ pathname เปล่า', async () => {
    mockSearchParams = new URLSearchParams('q=ท่อแตก&status=received');
    const user = userEvent.setup();
    render(<CaseFilterBar categories={mockCategories} />);

    const clearBtn = screen.getByRole('button', { name: /ล้างตัวกรอง/ });
    await user.click(clearBtn);

    const searchInput = screen.getByPlaceholderText('ค้นหาเลขที่เรื่อง / หัวเรื่อง / ที่ตั้ง');
    expect(searchInput).toHaveValue('');
    expect(pushMock).toHaveBeenCalledWith('/admin/reports');
  });

  it('เมื่อพิมพ์คำค้นหาและกดค้นหา router.push ไปยัง query string ที่มี q', async () => {
    mockSearchParams = new URLSearchParams('status=received');
    const user = userEvent.setup();
    render(<CaseFilterBar categories={mockCategories} />);

    const searchInput = screen.getByPlaceholderText('ค้นหาเลขที่เรื่อง / หัวเรื่อง / ที่ตั้ง');
    await user.type(searchInput, 'น้ำท่วมขัง');

    const submitBtn = screen.getByRole('button', { name: 'ค้นหา' });
    await user.click(submitBtn);

    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('q=%E0%B8%99%E0%B9%89%E0%B8%B3%E0%B8%97%E0%B9%88%E0%B8%A7%E0%B8%A1%E0%B8%82%E0%B8%B1%E0%B8%87'));
  });

  it('เมื่อกดปุ่ม preset วันที่ เช่น "7 วัน" router.push ไปยัง query string ที่มี preset=7d, from และ to', async () => {
    mockSearchParams = new URLSearchParams('status=received');
    const user = userEvent.setup();
    render(<CaseFilterBar categories={mockCategories} />);

    const preset7dBtn = screen.getByRole('button', { name: '7 วัน' });
    await user.click(preset7dBtn);

    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('preset=7d'));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('from='));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('to='));
  });

  it('เมื่อเลือก preset กำหนดเอง แสดงช่องเลือกวันที่ตั้งแต่วันที่ และถึงวันที่', async () => {
    mockSearchParams = new URLSearchParams('preset=custom&from=2026-10-01&to=2026-10-15');
    render(<CaseFilterBar categories={mockCategories} />);

    expect(screen.getByRole('button', { name: 'ตั้งแต่วันที่' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ถึงวันที่' })).toBeInTheDocument();
  });

  it('เมื่อ searchParams มี status=open ตัวเลือกใน Select แสดงคำว่า "กำลังดำเนินการทั้งหมด (เปิด)"', () => {
    mockSearchParams = new URLSearchParams('status=open');
    render(<CaseFilterBar categories={mockCategories} />);

    expect(screen.getByRole('combobox', { name: 'สถานะ' })).toHaveTextContent('กำลังดำเนินการทั้งหมด (เปิด)');
  });
});
