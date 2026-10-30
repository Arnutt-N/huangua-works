// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConfirm } from './use-confirm';

afterEach(() => cleanup());

function Harness({ onResult }: { onResult: (v: boolean) => void }) {
  const { confirm, dialog } = useConfirm();
  return (
    <>
      <button
        onClick={async () =>
          onResult(await confirm({ title: 'ลบรายการ', description: 'ยืนยันการลบ?', confirmText: 'ลบเลย', danger: true }))
        }
      >
        เริ่ม
      </button>
      {dialog}
    </>
  );
}

describe('useConfirm — มาตรฐานยืนยัน (FORM-06)', () => {
  it('ยังไม่เรียก confirm → ไม่มีกล่อง', () => {
    render(<Harness onResult={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('กดยืนยัน → resolve true และกล่องปิด', async () => {
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);
    fireEvent.click(screen.getByText('เริ่ม'));
    expect(await screen.findByText('ยืนยันการลบ?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ลบเลย' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('กดยกเลิก → resolve false', async () => {
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);
    fireEvent.click(screen.getByText('เริ่ม'));
    fireEvent.click(await screen.findByRole('button', { name: 'ยกเลิก' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('Escape → resolve false', async () => {
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);
    fireEvent.click(screen.getByText('เริ่ม'));
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('component ถูกถอดขณะกล่องเปิด → promise ที่ค้างถูกปล่อยเป็น false', async () => {
    const onResult = vi.fn();
    const { unmount } = render(<Harness onResult={onResult} />);
    fireEvent.click(screen.getByText('เริ่ม'));
    await screen.findByRole('dialog');
    unmount();
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });
});
