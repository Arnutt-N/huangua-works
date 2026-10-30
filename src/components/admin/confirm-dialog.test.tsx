// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

afterEach(() => cleanup());

function setup(busy: boolean) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(<ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="ลบรายการ" description="ยืนยันการลบ" busy={busy} />);
  return { onClose, onConfirm };
}

describe('ConfirmDialog — FORM-05 ปิดไม่ได้ระหว่างกำลังดำเนินการ', () => {
  it('ไม่ busy: Escape ปิดได้ และมีปุ่ม X', () => {
    const { onClose } = setup(false);
    expect(screen.getByRole('button', { name: 'ปิด' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ไม่ busy: ปุ่มยกเลิกเรียก onClose', () => {
    const { onClose } = setup(false);
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('busy: Escape ไม่ปิด', () => {
    const { onClose } = setup(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('busy: ไม่มีปุ่ม X และปุ่มยกเลิก/ยืนยันถูก disable', () => {
    setup(true);
    expect(screen.queryByRole('button', { name: 'ปิด' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ยกเลิก' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'กำลังดำเนินการ...' })).toBeDisabled();
  });

  it('busy: คลิกนอกกล่อง (overlay) ไม่ปิด', () => {
    const { onClose } = setup(true);
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
    expect(onClose).not.toHaveBeenCalled();
  });
});
