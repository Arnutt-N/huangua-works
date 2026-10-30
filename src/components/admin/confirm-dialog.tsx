'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'ยืนยัน',
  danger = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  danger?: boolean;
  busy?: boolean;
}) {
  // § busy = คำสั่งถูกส่งไปแล้ว — ปิดด้วย X/Escape/คลิก overlay ไม่ได้ ไม่งั้นผู้ใช้เห็นกล่องหายแล้วเข้าใจว่า
  // "ยกเลิก" ทั้งที่คำสั่งยังวิ่งอยู่ (FORM-05) ปุ่มยกเลิกก็ disabled อยู่แล้ว จึงไม่มีทางปิดจนกว่าจะเสร็จ
  const blockWhenBusy = (event: Event) => {
    if (busy) event.preventDefault();
  };
  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !busy ? onClose() : undefined)}>
      <DialogContent
        className="max-w-sm"
        showClose={!busy}
        onEscapeKeyDown={blockWhenBusy}
        onPointerDownOutside={blockWhenBusy}
        onInteractOutside={blockWhenBusy}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant={danger ? 'destructive' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'กำลังดำเนินการ...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
