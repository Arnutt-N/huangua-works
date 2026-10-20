// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CannedResponse } from '@/app/admin/chat/_lib/types';
import { CannedResponsesClient } from './canned-responses-client';

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
  it('ลิสต์แสดงชื่อ คีย์ลัด และเนื้อหา', async () => {
    fetchCannedResponses.mockResolvedValue([item()]);
    render(<CannedResponsesClient />);

    expect(await screen.findByText('ทักทาย')).toBeInTheDocument();
    expect(screen.getByText('/hello')).toBeInTheDocument();
    expect(screen.getByText('สวัสดีครับ ยินดีให้บริการ')).toBeInTheDocument();
  });

  it('ห้องว่างแสดง empty state ไทย', async () => {
    fetchCannedResponses.mockResolvedValue([]);
    render(<CannedResponsesClient />);

    expect(await screen.findByText('ยังไม่มีข้อความด่วน')).toBeInTheDocument();
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

  it('ลบแล้ว reload ลิสต์', async () => {
    const user = userEvent.setup();
    fetchCannedResponses.mockResolvedValueOnce([item()]).mockResolvedValueOnce([]);
    deleteCannedResponse.mockResolvedValue(true);
    render(<CannedResponsesClient />);
    await screen.findByText('ทักทาย');

    await user.click(screen.getByRole('button', { name: 'ลบ ทักทาย' }));

    await waitFor(() => expect(deleteCannedResponse).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText('ยังไม่มีข้อความด่วน')).toBeInTheDocument();
  });
});
