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
    expect(screen.getByRole('button', { name: '90 วัน' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ปีนี้' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'จากวันที่' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ค้นหาชื่อ / อีเมล / IP / resource id')).toBeInTheDocument();
  }, 15_000);

  it('เมื่อกดปุ่ม preset เช่น 30 วัน router.push ไปยัง query ที่มี preset=30d, from, to', async () => {
    const user = userEvent.setup();
    render(<AuditFilterBar actions={mockActions} />);

    const btn30d = screen.getByRole('button', { name: '30 วัน' });
    await user.click(btn30d);

    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('preset=30d'));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('from='));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('to='));
  });

  it('แสดงช่องวันที่สองช่องแม้ยังไม่เลือก preset', () => {
    render(<AuditFilterBar actions={mockActions} />);

    expect(screen.getByRole('textbox', { name: 'จากวันที่' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'ถึงวันที่' })).toBeInTheDocument();
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
