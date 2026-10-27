// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BroadcastItem } from '@/app/admin/_lib/admin-api';
import { BroadcastDetailClient } from './broadcast-detail-client';

const getBroadcast = vi.fn();
const sendBroadcast = vi.fn();
const cancelBroadcast = vi.fn();
vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    getBroadcast: (...args: unknown[]) => getBroadcast(...args),
    sendBroadcast: (...args: unknown[]) => sendBroadcast(...args),
    cancelBroadcast: (...args: unknown[]) => cancelBroadcast(...args),
  },
}));

function item(over: Partial<BroadcastItem> = {}): BroadcastItem {
  return {
    id: 'b1',
    title: 'ประกาศน้ำประปา',
    content: [{ type: 'text', text: 'ประกาศน้ำประปา' }],
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

afterEach(() => cleanup());

beforeEach(() => {
  getBroadcast.mockReset();
  sendBroadcast.mockReset();
  cancelBroadcast.mockReset();
  getBroadcast.mockResolvedValue({ ok: true, data: item() });
  sendBroadcast.mockResolvedValue({ ok: true, data: { ok: true } });
  cancelBroadcast.mockResolvedValue({ ok: true, data: { ok: true } });
});

describe('BroadcastDetailClient', () => {
  it('แสดงสถิติ + ไทม์ไลน์ + ปุ่มส่งเมื่อ draft', async () => {
    render(<BroadcastDetailClient broadcastId="b1" />);
    expect((await screen.findAllByText('ประกาศน้ำประปา')).length).toBeGreaterThan(0);
    expect(screen.getByText('สถิติการส่ง')).toBeInTheDocument();
    expect(screen.getByText('ไทม์ไลน์')).toBeInTheDocument();
    expect(screen.getByText('สร้างแบบร่าง')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ส่ง' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ยกเลิกประกาศ/ })).toBeInTheDocument();
  });

  it('draft กดยกเลิก → confirm dialog → cancelBroadcast', async () => {
    const user = userEvent.setup();
    render(<BroadcastDetailClient broadcastId="b1" />);
    await screen.findAllByText('ประกาศน้ำประปา');

    await user.click(screen.getByRole('button', { name: /ยกเลิกประกาศ/ }));
    await user.click(screen.getByRole('button', { name: 'ยืนยันยกเลิก' }));
    await waitFor(() => expect(cancelBroadcast).toHaveBeenCalledWith('b1'));
  });

  it('แถว sent แสดงอัตราสำเร็จ ไม่ปุ่มส่ง/ยกเลิก', async () => {
    getBroadcast.mockResolvedValue({
      ok: true,
      data: item({ status: 'sent', totalRecipients: 100, successCount: 90, failedCount: 10, sentAt: '2026-01-02T00:00:00Z' }),
    });
    render(<BroadcastDetailClient broadcastId="b1" />);
    expect(await screen.findByText('ส่งสำเร็จ')).toBeInTheDocument();
    expect(screen.getByText('90.0%')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ส่ง' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ยกเลิกประกาศ/ })).not.toBeInTheDocument();
  });

  it('กดส่งยิง send + reload', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    getBroadcast
      .mockResolvedValueOnce({ ok: true, data: item() })
      .mockResolvedValueOnce({ ok: true, data: item({ status: 'sent' }) });
    render(<BroadcastDetailClient broadcastId="b1" />);
    await screen.findAllByText('ประกาศน้ำประปา');

    await user.click(screen.getByRole('button', { name: 'ส่ง' }));
    await waitFor(() => expect(sendBroadcast).toHaveBeenCalledWith('b1'));
    confirmSpy.mockRestore();
  });

  it('ไม่มีข้อมูลแสดงข้อความไทย', async () => {
    getBroadcast.mockResolvedValue({ ok: false, error: 'ไม่พบ broadcast', status: 404, code: 'HTTP' });
    render(<BroadcastDetailClient broadcastId="nope" />);
    expect(await screen.findByText('ไม่พบข้อมูล broadcast')).toBeInTheDocument();
  });
});
