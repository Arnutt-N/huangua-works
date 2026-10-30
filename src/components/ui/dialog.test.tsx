// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';

afterEach(() => cleanup());

describe('A11Y-03 Dialog primitives & scroll bounds', () => {
  it('DialogContent มี max-h dvh, overflow scroll และ accessible close button', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>หัวข้อกล่องข้อความ</DialogTitle>
            <DialogDescription>คำอธิบายกล่องข้อความ</DialogDescription>
          </DialogHeader>
          <div className="h-96">เนื้อหายาว</div>
          <DialogFooter>
            <Button>ตกลง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // A11Y-03: ต้องมี max-h อิง 100dvh และ overflow-y-auto ป้องกันเนื้อหาล้นจอเตี้ย
    expect(dialog.className).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/);
    expect(dialog.className).toMatch(/overflow-y-auto/);
    expect(dialog.className).toMatch(/overscroll-contain/);

    // ปุ่ม X ปิดต้องมี aria-label="ปิด"
    const closeBtn = screen.getByRole('button', { name: 'ปิด' });
    expect(closeBtn).toBeInTheDocument();
  });

  it('showClose={false} ซ่อนปุ่ม X เมื่อกำลัง busy หรือไม่อนุญาตให้ปิดกลางทาง', () => {
    render(
      <Dialog open>
        <DialogContent showClose={false}>
          <DialogHeader>
            <DialogTitle>กำลังประมวลผล</DialogTitle>
          </DialogHeader>
          <p>กรุณารอสักครู่...</p>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByRole('button', { name: 'ปิด' })).not.toBeInTheDocument();
  });
});
