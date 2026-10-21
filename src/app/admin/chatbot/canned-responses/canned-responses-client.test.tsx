// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CannedResponse } from '@/app/admin/chat/_lib/types';
import { CannedResponsesClient } from './canned-responses-client';

// § เทสนี้รัน userEvent หลายขั้นภายใต้โหลดทั้งชุด timeout 5s ไม่พอ — 30s ตาม intake pattern
vi.setConfig({ testTimeout: 30_000 });

const fetchCannedResponses = vi.fn();
const createCannedResponse = vi.fn();
const updateCannedResponse = vi.fn();
const deleteCannedResponse = vi.fn();
vi.mock('@/app/admin/chat/_lib/api', () => ({
  fetchCannedResponses: (...args: unknown[]) => fetchCannedResponses(...args),
  createCannedResponse: (...args: unknown[]) => createCannedResponse(...args),
  updateCannedResponse: (...args: unknown[]) => updateCannedResponse(...args),
  deleteCannedResponse: (...args: unknown[]) => deleteCannedResponse(...args),
}));

function item(over: Partial<CannedResponse> = {}): CannedResponse {
  return {
    id: 'c1',
    title: 'ทักทาย',
    shortcut: 'hello',
    content: 'สวัสดีครับ ยินดีให้บริการ',
    ...over,
  };
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  fetchCannedResponses.mockReset();
  createCannedResponse.mockReset();
  updateCannedResponse.mockReset();
  deleteCannedResponse.mockReset();
});

describe('CannedResponsesClient หน้าแยก', () => {
  it('ตาราง ชอร์ตคัต/ข้อความ/จัดการ + แถว /shortcut', async () => {
    fetchCannedResponses.mockResolvedValue([item()]);
    render(<CannedResponsesClient />);
    expect(await screen.findByText('ชอร์ตคัต')).toBeInTheDocument();
    expect(screen.getByText('ข้อความ')).toBeInTheDocument();
    expect(screen.getByText('จัดการ')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('/hello')).toBeInTheDocument();
    expect(within(table).getByText('ทักทาย')).toBeInTheDocument();
    expect(within(table).getByText('สวัสดีครับ ยินดีให้บริการ')).toBeInTheDocument();
  });

  it('ไม่มี shortcut แสดงชื่ออย่างเดียว', async () => {
    fetchCannedResponses.mockResolvedValue([item({ shortcut: null })]);
    render(<CannedResponsesClient />);
    const table = await screen.findByRole('table');
    expect(within(table).getByText('ทักทาย')).toBeInTheDocument();
    expect(within(table).queryByText('/hello')).not.toBeInTheDocument();
  });

  it('โหลดล้มเหลวแสดง error ไม่ใช่ empty state', async () => {
    fetchCannedResponses.mockResolvedValue(null);
    render(<CannedResponsesClient />);
    expect(await screen.findByText('โหลดข้อมูลไม่สำเร็จ')).toBeInTheDocument();
    expect(screen.queryByText('ยังไม่มีข้อความด่วน')).not.toBeInTheDocument();
  });

  it('ลบต้อง confirm ก่อน — ยกเลิกไม่ยิง API', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fetchCannedResponses.mockResolvedValue([item()]);
    render(<CannedResponsesClient />);
    await screen.findByText('ทักทาย');

    await user.click(screen.getByRole('button', { name: 'ลบ ทักทาย' }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteCannedResponse).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('สร้างข้อความใหม่แล้ว reload ลิสต์', async () => {
    const user = userEvent.setup();
    fetchCannedResponses.mockResolvedValueOnce([]).mockResolvedValueOnce([item()]);
    createCannedResponse.mockResolvedValue({ ok: true });
    render(<CannedResponsesClient />);
    await screen.findByText('ยังไม่มีข้อความด่วน');

    await user.click(screen.getByRole('button', { name: 'เพิ่มข้อความด่วน' }));
    await user.type(screen.getByLabelText('ชื่อ'), 'ทักทาย');
    await user.type(screen.getByLabelText('เนื้อหา'), 'สวัสดีครับ ยินดีให้บริการ');
    await user.click(screen.getByRole('button', { name: 'เพิ่ม' }));

    await waitFor(() => expect(createCannedResponse).toHaveBeenCalled());
    expect(await screen.findByText('ทักทาย')).toBeInTheDocument();
  });

  it('ปุ่มบันทึกปิดเมื่อชื่อหรือเนื้อหาว่าง', async () => {
    const user = userEvent.setup();
    fetchCannedResponses.mockResolvedValue([]);
    render(<CannedResponsesClient />);
    await screen.findByText('ยังไม่มีข้อความด่วน');

    await user.click(screen.getByRole('button', { name: 'เพิ่มข้อความด่วน' }));

    expect(screen.getByRole('button', { name: 'เพิ่ม' })).toBeDisabled();
  });

  it('บันทึกซ้ำ shortcut ชนคืน 409 โชว์ใน dialog', async () => {
    const user = userEvent.setup();
    fetchCannedResponses.mockResolvedValue([]);
    createCannedResponse.mockResolvedValue({ ok: false, error: 'shortcut นี้ถูกใช้แล้ว' });
    render(<CannedResponsesClient />);
    await screen.findByText('ยังไม่มีข้อความด่วน');

    await user.click(screen.getByRole('button', { name: 'เพิ่มข้อความด่วน' }));
    await user.type(screen.getByLabelText('ชื่อ'), 'ซ้ำ');
    await user.type(screen.getByLabelText('เนื้อหา'), 'เนื้อหาซ้ำ');
    await user.click(screen.getByRole('button', { name: 'เพิ่ม' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('shortcut นี้ถูกใช้แล้ว');
    await waitFor(() => expect(createCannedResponse).toHaveBeenCalled());
  });

  it('ลบแล้ว reload ลิสต์', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fetchCannedResponses.mockResolvedValueOnce([item()]).mockResolvedValueOnce([]);
    deleteCannedResponse.mockResolvedValue(true);
    render(<CannedResponsesClient />);
    await screen.findByText('ทักทาย');

    await user.click(screen.getByRole('button', { name: 'ลบ ทักทาย' }));

    await waitFor(() => expect(deleteCannedResponse).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText('ยังไม่มีข้อความด่วน')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
