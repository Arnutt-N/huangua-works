// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CannedResponse } from '@/app/admin/chat/_lib/types';
import { Composer } from './composer';

// § userEvent หลายขั้น — timeout 30s ตาม pattern wizard/intake
vi.setConfig({ testTimeout: 30_000 });

function canned(over: Partial<CannedResponse> = {}): CannedResponse {
  return { id: 'c1', title: 'ทักทาย', shortcut: 'hello', content: 'สวัสดีครับ', ...over };
}

afterEach(() => cleanup());

describe('Composer quick replies JSK', () => {
  const base = {
    mode: 'human_active',
    ownershipBanner: null,
    actionError: null,
    onSend: vi.fn(),
    onTakeover: vi.fn(),
    onManageCanned: vi.fn(),
  };

  beforeEach(() => {
    base.onSend.mockReset();
    base.onManageCanned.mockReset();
    // § jsdom ไม่มี scrollIntoView — CannedPicker เรียกตอน highlight เปลี่ยน
    Element.prototype.scrollIntoView ??= vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
  });

  it('ปุ่มลัด 3 ตัวแรก — กดแล้วใส่เนื้อหาลงช่องพิมพ์', async () => {
    const user = userEvent.setup();
    render(<Composer {...base} canReply cannedResponses={[canned(), canned({ id: 'c2', title: 'ขอบคุณ', shortcut: 'thanks', content: 'ขอบคุณครับ' })]} />);
    await user.click(screen.getByRole('button', { name: 'ทักทาย' }));
    expect(screen.getByLabelText('พิมพ์ข้อความ')).toHaveValue('สวัสดีครับ');
  });

  it('quick reply ไม่ทับ picker — กดปุ่มไม่เปิด listbox', async () => {
    const user = userEvent.setup();
    render(<Composer {...base} canReply cannedResponses={[canned()]} />);
    await user.click(screen.getByRole('button', { name: 'ทักทาย' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('ไม่มี canned ไม่แสดงแถบ quick replies', async () => {
    render(<Composer {...base} canReply cannedResponses={[]} />);
    expect(screen.queryByRole('button', { name: 'ทักทาย' })).not.toBeInTheDocument();
  });

  it('5 แถวแสดงแค่ 3 ตัวแรก — เกินไม่ล้น composer', async () => {
    const rows = [canned(), canned({ id: 'c2', title: 'ขอบคุณ', shortcut: 'thanks', content: 'ขอบคุณครับ' }), canned({ id: 'c3', title: 'รอสักครู่' }), canned({ id: 'c4', title: 'ส่งต่อ' }), canned({ id: 'c5', title: 'ปิดเรื่อง' })];
    render(<Composer {...base} canReply cannedResponses={rows} />);
    const bar = screen.getByRole('group', { name: 'ข้อความด่วน' });
    expect(within(bar).getAllByRole('button')).toHaveLength(3);
    expect(within(bar).queryByRole('button', { name: 'ส่งต่อ' })).not.toBeInTheDocument();
  });

  it('กด quick reply แล้วโฟกัสช่องพิมพ์ — พิมพ์ต่อได้ทันที', async () => {
    const user = userEvent.setup();
    render(<Composer {...base} canReply cannedResponses={[canned()]} />);
    await user.click(screen.getByRole('button', { name: 'ทักทาย' }));
    expect(screen.getByLabelText('พิมพ์ข้อความ')).toHaveFocus();
  });

  it('พิมพ์ / ค้างไว้หลังปิด picker — ไม่กลืนหาย', async () => {
    const user = userEvent.setup();
    render(<Composer {...base} canReply cannedResponses={[canned()]} />);
    const box = screen.getByLabelText('พิมพ์ข้อความ');
    await user.type(box, '/ทัก');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(box).toHaveValue('/ทัก');
  });

  it('มีปุ่มจัดการข้อความสำเร็จรูป — เรียก onManageCanned', async () => {
    const user = userEvent.setup();
    render(<Composer {...base} canReply cannedResponses={[canned()]} />);
    await user.click(screen.getByRole('button', { name: 'จัดการข้อความสำเร็จรูป' }));
    expect(base.onManageCanned).toHaveBeenCalledTimes(1);
  });
});
