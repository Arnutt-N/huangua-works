// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditFilterBar } from './audit-filter-bar';

const pushMock = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => mockSearchParams,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
});

describe('AuditFilterBar (Tranche F)', () => {
  const mockActions = ['CREATE_CASE', 'UPDATE_CASE', 'LOGIN_SUCCESS'];

  it('เรนเดอร์ปุ่ม preset และ select ฟิลด์ครบถ้วน', () => {
    render(<AuditFilterBar actions={mockActions} />);

    expect(screen.getByRole('button', { name: '7 วัน' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 วัน' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ปีงบประมาณนี้' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ค้นหาชื่อ / อีเมล / IP / resource id')).toBeInTheDocument();
  });

  it('เมื่อกดปุ่ม preset เช่น 30 วัน router.push ไปยัง query ที่มี preset=30d, from, to', async () => {
    const user = userEvent.setup();
    render(<AuditFilterBar actions={mockActions} />);

    const btn30d = screen.getByRole('button', { name: '30 วัน' });
    await user.click(btn30d);

    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('preset=30d'));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('from='));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('to='));
  });

  it('เมื่อ preset เป็น custom แสดง date picker สองช่อง', () => {
    mockSearchParams = new URLSearchParams('preset=custom&from=2026-10-01&to=2026-10-15');
    render(<AuditFilterBar actions={mockActions} />);

    expect(screen.getByRole('button', { name: 'ตั้งแต่วันที่' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ถึงวันที่' })).toBeInTheDocument();
  });

  it('เมื่อกดล้างตัวกรอง router.push ไปยัง /admin/audit แบบไม่มี params', async () => {
    mockSearchParams = new URLSearchParams('action=CREATE_CASE&preset=7d');
    const user = userEvent.setup();
    render(<AuditFilterBar actions={mockActions} />);

    const clearBtn = screen.getByRole('button', { name: /ล้างตัวกรอง/ });
    await user.click(clearBtn);

    expect(pushMock).toHaveBeenCalledWith('/admin/audit');
  });
});
