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
    category: 'info',
    usageCount: 3,
    isActive: true,
    updatedAt: '2026-01-01T00:00:00Z',
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

describe('CannedResponsesClient ตาราง JSK', () => {
  it('หัวตาราง 6 คอลัมน์ + PageHeader + แถว /shortcut + หมวดหมู่/ใช้ไป', async () => {
    fetchCannedResponses.mockResolvedValue([item()]);
    render(<CannedResponsesClient />);
    expect(await screen.findByText('/hello')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ข้อความสำเร็จรูป' })).toBeInTheDocument();
    expect(screen.getByText('ชอร์ตคัต')).toBeInTheDocument();
    expect(screen.getByText('ข้อความ')).toBeInTheDocument();
    expect(screen.getByText('หมวดหมู่')).toBeInTheDocument();
    expect(screen.getByText('สถานะ')).toBeInTheDocument();
    expect(screen.getByText('ใช้ไป')).toBeInTheDocument();
    expect(screen.getByText('จัดการ')).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(within(table).getByText('ทักทาย')).toBeInTheDocument();
    expect(within(table).getByText('สวัสดีครับ ยินดีให้บริการ')).toBeInTheDocument();
    expect(within(table).getByText('ข้อมูลทั่วไป')).toBeInTheDocument();
    expect(within(table).getByText('ใช้งานอยู่')).toBeInTheDocument();
    expect(within(table).getByText('3')).toBeInTheDocument();
  });

  it('โหลดแบบ include_inactive=true เสมอ (เห็นของที่ปิดใช้งาน)', async () => {
    fetchCannedResponses.mockResolvedValue([item({ isActive: false })]);
    render(<CannedResponsesClient />);
    expect(await screen.findByText('ปิดใช้งาน')).toBeInTheDocument();
    expect(fetchCannedResponses).toHaveBeenCalledWith(true);
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
    expect(screen.queryByText('ยังไม่มีข้อความสำเร็จรูป')).not.toBeInTheDocument();
  });

  it('สวิตช์เปิด/ปิดยิง updateCannedResponse isActive', async () => {
    const user = userEvent.setup();
    fetchCannedResponses.mockResolvedValue([item()]);
    updateCannedResponse.mockResolvedValue({ ok: true });
    render(<CannedResponsesClient />);
    await screen.findByText('ทักทาย');

    const toggle = screen.getByRole('switch', { name: 'ปิดใช้งาน ทักทาย' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);

    await waitFor(() => expect(updateCannedResponse).toHaveBeenCalledWith('c1', { isActive: false }));
  });

  it('ดูรายละเอียดเปิด DetailModal แสดงข้อความเต็ม', async () => {
    const user = userEvent.setup();
    fetchCannedResponses.mockResolvedValue([item()]);
    render(<CannedResponsesClient />);
    await screen.findByText('ทักทาย');

    await user.click(screen.getByRole('button', { name: 'ดูรายละเอียด ทักทาย' }));
    expect(await screen.findByText('รายละเอียดข้อความสำเร็จรูป')).toBeInTheDocument();
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

  it('สร้างข้อความใหม่ต้องกรอกชอร์ตคัต + หมวดหมู่ถูกส่งไปด้วย', async () => {
    const user = userEvent.setup();
    fetchCannedResponses.mockResolvedValueOnce([]).mockResolvedValueOnce([item()]);
    createCannedResponse.mockResolvedValue({ ok: true });
    render(<CannedResponsesClient />);
    await screen.findByText('ยังไม่มีข้อความสำเร็จรูป');

    await user.click(screen.getByRole('button', { name: 'เพิ่มข้อความ' }));
    await user.type(screen.getByLabelText(/ชอร์ตคัต/), 'hello');
    await user.type(screen.getByLabelText('ชื่อ'), 'ทักทาย');
    await user.type(screen.getByLabelText('เนื้อหา'), 'สวัสดีครับ ยินดีให้บริการ');
    await user.selectOptions(screen.getByLabelText('หมวดหมู่'), 'greeting');
    await user.click(screen.getByRole('button', { name: 'เพิ่ม' }));

    await waitFor(() =>
      expect(createCannedResponse).toHaveBeenCalledWith({
        title: 'ทักทาย',
        shortcut: 'hello',
        content: 'สวัสดีครับ ยินดีให้บริการ',
        category: 'greeting',
      }),
    );
    expect(await screen.findByText('ทักทาย')).toBeInTheDocument();
  });

  it('ปุ่มบันทึกปิดเมื่อชอร์ตคัต/ชื่อ/เนื้อหายังว่าง', async () => {
    const user = userEvent.setup();
    fetchCannedResponses.mockResolvedValue([]);
    render(<CannedResponsesClient />);
    await screen.findByText('ยังไม่มีข้อความสำเร็จรูป');

    await user.click(screen.getByRole('button', { name: 'เพิ่มข้อความ' }));

    expect(screen.getByRole('button', { name: 'เพิ่ม' })).toBeDisabled();
  });

  it('shortcut ชนคืน 409 โชว์ใน dialog', async () => {
    const user = userEvent.setup();
    fetchCannedResponses.mockResolvedValue([]);
    createCannedResponse.mockResolvedValue({ ok: false, error: 'shortcut นี้ถูกใช้แล้ว' });
    render(<CannedResponsesClient />);
    await screen.findByText('ยังไม่มีข้อความสำเร็จรูป');

    await user.click(screen.getByRole('button', { name: 'เพิ่มข้อความ' }));
    await user.type(screen.getByLabelText(/ชอร์ตคัต/), 'dup');
    await user.type(screen.getByLabelText('ชื่อ'), 'ซ้ำ');
    await user.type(screen.getByLabelText('เนื้อหา'), 'เนื้อหาซ้ำ');
    await user.click(screen.getByRole('button', { name: 'เพิ่ม' }));

    expect(await screen.findByText('shortcut นี้ถูกใช้แล้ว')).toBeInTheDocument();
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
    expect(await screen.findByText('ยังไม่มีข้อความสำเร็จรูป')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
