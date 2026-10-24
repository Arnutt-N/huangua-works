// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BroadcastItem } from '@/app/admin/_lib/admin-api';
import { BroadcastClient } from './broadcast-client';

const listBroadcasts = vi.fn();
const sendBroadcast = vi.fn();
const cancelBroadcast = vi.fn();
const listBroadcastRecipients = vi.fn();
const dryRunBroadcast = vi.fn();
const createBroadcast = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listBroadcasts: (...args: unknown[]) => listBroadcasts(...args),
    sendBroadcast: (...args: unknown[]) => sendBroadcast(...args),
    cancelBroadcast: (...args: unknown[]) => cancelBroadcast(...args),
    listBroadcastRecipients: (...args: unknown[]) => listBroadcastRecipients(...args),
    dryRunBroadcast: (...args: unknown[]) => dryRunBroadcast(...args),
    createBroadcast: (...args: unknown[]) => createBroadcast(...args),
  },
}));

function item(over: Partial<BroadcastItem> = {}): BroadcastItem {
  return {
    id: 'b1',
    title: 'ประกาศน้ำประปา',
    content: [{ type: 'text', text: 'ประกาศน้ำประปาหยุดจ่ายวันนี้' }],
    status: 'draft',
    target: { kind: 'all' },
    scheduledAt: null,
    sentAt: null,
    updatedAt: '2026-01-01T00:00:00Z',
    totalRecipients: 0,
    successCount: 0,
    failedCount: 0,
    failedRecipients: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function page(items: BroadcastItem[]) {
  return { ok: true, data: { items, total: items.length, page: 1, pageSize: 20 } };
}

afterEach(() => cleanup());

beforeEach(() => {
  listBroadcasts.mockReset();
  sendBroadcast.mockReset();
  cancelBroadcast.mockReset();
  listBroadcastRecipients.mockReset();
  dryRunBroadcast.mockReset();
  createBroadcast.mockReset();
  listBroadcasts.mockResolvedValue(page([item()]));
  listBroadcastRecipients.mockResolvedValue({ ok: true, data: { items: [] } });
});

describe('BroadcastClient ตาราง JSK', () => {
  it('หัวตาราง 6 คอลัมน์ + PageHeader + footer ทั้งหมด N รายการ', async () => {
    render(<BroadcastClient />);
    // § findByRole('table') คืนได้ตั้งแต่ thead โผล่ — ต้องรอแถวจริงกัน assertion แถวพังแบบ flaky
    expect(await screen.findByText('ประกาศน้ำประปา')).toBeInTheDocument();
    expect(screen.getByText('ชื่อแคมเปญ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ส่งข้อความแบบกระจาย' })).toBeInTheDocument();
    expect(screen.getByText('ประเภท')).toBeInTheDocument();
    expect(screen.getByText('สถานะ')).toBeInTheDocument();
    expect(screen.getByText('ผู้รับ')).toBeInTheDocument();
    expect(screen.getByText('วันที่ส่ง')).toBeInTheDocument();
    expect(screen.getByText('จัดการ')).toBeInTheDocument();
    expect(screen.getByText(/ทั้งหมด 1 รายการ/)).toBeInTheDocument();
    // § ชน option ใน select ฟิลเตอร์ — เจาะจงในตาราง
    const table = screen.getByRole('table');
    expect(within(table).getByText('ข้อความ')).toBeInTheDocument();
    expect(within(table).getByText('ร่าง')).toBeInTheDocument();
  });

  it('title null fallback ใช้ข้อความแรกของ content', async () => {
    listBroadcasts.mockResolvedValue(page([item({ title: null })]));
    render(<BroadcastClient />);
    expect(await screen.findByText('ประกาศน้ำประปาหยุดจ่ายวันนี้')).toBeInTheDocument();
  });

  it('ห้องว่างแสดง empty JSK + ปุ่มสร้างข้อความแรก', async () => {
    listBroadcasts.mockResolvedValue(page([]));
    render(<BroadcastClient />);
    expect(await screen.findByText('ยังไม่มีข้อความ Broadcast')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'สร้างข้อความแรก' })).toBeInTheDocument();
  });

  it('ฟิลเตอร์สถานะเปลี่ยนแล้ว reload', async () => {
    const user = userEvent.setup();
    listBroadcasts.mockResolvedValue(page([]));
    render(<BroadcastClient />);
    await screen.findByText('ยังไม่มีข้อความ Broadcast');

    await user.selectOptions(screen.getByLabelText('กรองสถานะ'), 'sent');
    await waitFor(() => expect(listBroadcasts).toHaveBeenCalledTimes(2));
  });

  it('draft กดส่งเลยยิง send + reload', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    listBroadcasts
      .mockResolvedValueOnce(page([item()]))
      .mockResolvedValueOnce(page([]));
    sendBroadcast.mockResolvedValue({ ok: true, data: { ok: true } });
    render(<BroadcastClient />);
    await screen.findByText('ประกาศน้ำประปา');

    await user.click(screen.getByRole('button', { name: 'ส่งเลย' }));
    await waitFor(() => expect(sendBroadcast).toHaveBeenCalledWith('b1'));
    confirmSpy.mockRestore();
  });

  it('draft กดถังขยะ → confirm → cancelBroadcast ยิง soft-delete', async () => {
    const user = userEvent.setup();
    listBroadcasts
      .mockResolvedValueOnce(page([item()]))
      .mockResolvedValueOnce(page([]));
    cancelBroadcast.mockResolvedValue({ ok: true, data: { ok: true } });
    render(<BroadcastClient />);
    await screen.findByText('ประกาศน้ำประปา');

    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    await user.click(screen.getByRole('button', { name: 'ยืนยันยกเลิก' }));
    await waitFor(() => expect(cancelBroadcast).toHaveBeenCalledWith('b1'));
  });

  it('แถว sent แสดงจำนวนสำเร็จ/ล้มเหลว ไม่มีปุ่มส่ง/ยกเลิก', async () => {
    listBroadcasts.mockResolvedValue(
      page([item({ status: 'sent', totalRecipients: 100, successCount: 90, failedCount: 10 })]),
    );
    render(<BroadcastClient />);
    expect(await screen.findByText('90 สำเร็จ')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('ส่งแล้ว')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ส่งเลย' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ยกเลิก' })).not.toBeInTheDocument();
  });

  it('skeleton 5 บล็อกตอนโหลด — ไม่ใช่ข้อความ "กำลังโหลด..." ลอย', async () => {
    listBroadcasts.mockReturnValue(new Promise(() => {}));
    render(<BroadcastClient />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/กำลังโหลด/)).not.toBeInTheDocument();
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(5);
  });
});
