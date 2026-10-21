// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BroadcastItem } from '@/app/admin/_lib/admin-api';
import { BroadcastClient } from './broadcast-client';

const listBroadcasts = vi.fn();
const sendBroadcast = vi.fn();
const listBroadcastRecipients = vi.fn();
const dryRunBroadcast = vi.fn();
const createBroadcast = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listBroadcasts: (...args: unknown[]) => listBroadcasts(...args),
    sendBroadcast: (...args: unknown[]) => sendBroadcast(...args),
    listBroadcastRecipients: (...args: unknown[]) => listBroadcastRecipients(...args),
    dryRunBroadcast: (...args: unknown[]) => dryRunBroadcast(...args),
    createBroadcast: (...args: unknown[]) => createBroadcast(...args),
  },
}));

function item(over: Partial<BroadcastItem> = {}): BroadcastItem {
  return {
    id: 'b1',
    content: [{ type: 'text', text: 'ประกาศน้ำประปา' }],
    status: 'draft',
    target: { kind: 'all' },
    scheduledAt: null,
    sentAt: null,
    totalRecipients: 0,
    successCount: 0,
    failedCount: 0,
    failedRecipients: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

afterEach(() => cleanup());

beforeEach(() => {
  listBroadcasts.mockReset();
  sendBroadcast.mockReset();
  listBroadcastRecipients.mockReset();
  dryRunBroadcast.mockReset();
  createBroadcast.mockReset();
  listBroadcasts.mockResolvedValue({ ok: true, data: { items: [item()] } });
  listBroadcastRecipients.mockResolvedValue({ ok: true, data: { items: [] } });
});

describe('BroadcastClient ตาราง JSK', () => {
  it('หัวตาราง 6 คอลัมน์ + แถวแสดงชื่อ/ประเภท/สถานะ', async () => {
    render(<BroadcastClient />);
    expect(await screen.findByText('ชื่อแคมเปญ')).toBeInTheDocument();
    expect(screen.getByText('ประเภท')).toBeInTheDocument();
    expect(screen.getByText('สถานะ')).toBeInTheDocument();
    expect(screen.getByText('ผู้รับ')).toBeInTheDocument();
    expect(screen.getByText('วันที่ส่ง')).toBeInTheDocument();
    expect(screen.getByText('จัดการ')).toBeInTheDocument();
    expect(screen.getByText('ประกาศน้ำประปา')).toBeInTheDocument();
    // § ชน option ใน select ฟิลเตอร์ — เจาะจงในตาราง
    const table = screen.getByRole('table');
    expect(within(table).getByText('ข้อความ')).toBeInTheDocument();
    expect(within(table).getByText('ร่าง')).toBeInTheDocument();
  });

  it('ห้องว่างแสดง empty JSK + ปุ่มสร้างข้อความแรก', async () => {
    listBroadcasts.mockResolvedValue({ ok: true, data: { items: [] } });
    render(<BroadcastClient />);
    expect(await screen.findByText('ยังไม่มีข้อความ Broadcast')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'สร้างข้อความแรก' })).toBeInTheDocument();
  });

  it('ฟิลเตอร์สถานะเปลี่ยนแล้ว reload', async () => {
    const user = userEvent.setup();
    listBroadcasts.mockResolvedValue({ ok: true, data: { items: [] } });
    render(<BroadcastClient />);
    await screen.findByText('ยังไม่มีข้อความ Broadcast');

    await user.selectOptions(screen.getByLabelText('กรองสถานะ'), 'sent');
    await waitFor(() => expect(listBroadcasts).toHaveBeenCalledTimes(2));
  });

  it('draft กดส่งเลยยิง send + reload', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    listBroadcasts
      .mockResolvedValueOnce({ ok: true, data: { items: [item()] } })
      .mockResolvedValueOnce({ ok: true, data: { items: [] } });
    sendBroadcast.mockResolvedValue({ ok: true, data: { ok: true } });
    render(<BroadcastClient />);
    await screen.findByText('ประกาศน้ำประปา');

    await user.click(screen.getByRole('button', { name: 'ส่งเลย' }));
    await waitFor(() => expect(sendBroadcast).toHaveBeenCalledWith('b1'));
    confirmSpy.mockRestore();
  });

  it('แถว sent แสดงจำนวนสำเร็จ/ล้มเหลว ไม่ปุ่มส่ง', async () => {
    listBroadcasts.mockResolvedValue({
      ok: true,
      data: { items: [item({ status: 'sent', totalRecipients: 100, successCount: 90, failedCount: 10 })] },
    });
    render(<BroadcastClient />);
    const table = await screen.findByRole('table');
    expect(within(table).getByText('ส่งแล้ว')).toBeInTheDocument();
    expect(screen.getByText('90 สำเร็จ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ส่งเลย' })).not.toBeInTheDocument();
  });
});
