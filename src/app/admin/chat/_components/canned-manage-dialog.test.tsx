// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CannedResponse } from '../_lib/types';
import { CannedManageDialog } from './canned-manage-dialog';

vi.setConfig({ testTimeout: 30_000 });

const deleteCannedResponse = vi.fn();
const updateCannedResponse = vi.fn();
const createCannedResponse = vi.fn();
vi.mock('../_lib/api', () => ({
  deleteCannedResponse: (...args: unknown[]) => deleteCannedResponse(...args),
  updateCannedResponse: (...args: unknown[]) => updateCannedResponse(...args),
  createCannedResponse: (...args: unknown[]) => createCannedResponse(...args),
}));

function item(over: Partial<CannedResponse> = {}): CannedResponse {
  return { id: 'c1', title: 'ทักทาย', shortcut: 'hello', content: 'สวัสดีครับ', ...over };
}

function renderDialog(items: CannedResponse[] = [item()], onChanged = vi.fn()) {
  return render(
    <CannedManageDialog open onOpenChange={() => {}} items={items} onChanged={onChanged} />,
  );
}

afterEach(() => cleanup());

beforeEach(() => {
  deleteCannedResponse.mockReset();
  updateCannedResponse.mockReset();
  createCannedResponse.mockReset();
});

describe('CannedManageDialog', () => {
  it('ยกเลิก confirm ไม่ยิง API', async () => {
    const user = userEvent.setup();
    const nativeConfirm = vi.spyOn(window, 'confirm');
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'ลบ ทักทาย' }));
    expect(await screen.findByText('ลบข้อความสำเร็จรูป')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(deleteCannedResponse).not.toHaveBeenCalled();
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it('ลบสำเร็จเรียก onChanged + ล้าง error เก่า', async () => {
    const user = userEvent.setup();
    const nativeConfirm = vi.spyOn(window, 'confirm');
    deleteCannedResponse.mockResolvedValue(true);
    const onChanged = vi.fn();
    renderDialog([item()], onChanged);
    await user.click(screen.getByRole('button', { name: 'ลบ ทักทาย' }));
    expect(await screen.findByText('ลบข้อความสำเร็จรูป')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ลบ' }));
    await waitFor(() => expect(deleteCannedResponse).toHaveBeenCalledWith('c1'));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it('ลบล้มเหลวเห็น error ค้างนอกฟอร์ม', async () => {
    const user = userEvent.setup();
    deleteCannedResponse.mockResolvedValue(false);
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'ลบ ทักทาย' }));
    expect(await screen.findByText('ลบข้อความสำเร็จรูป')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ลบ' }));
    expect(await screen.findByText('ลบไม่สำเร็จ')).toBeInTheDocument();
  });
});
