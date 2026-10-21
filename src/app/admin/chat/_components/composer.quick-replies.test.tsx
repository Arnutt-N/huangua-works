// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CannedResponse } from '@/app/admin/chat/_lib/types';
import { Composer } from './composer';

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
});
