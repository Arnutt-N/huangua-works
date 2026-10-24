'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * useLiffLeave + LeaveConfirmDialog — ถามก่อนปิด/ออกจากฟอร์ม LIFF
 *
 * § ยกกลไกมาจาก jsk (PR #291) — ใน LINE ปุ่มยกเลิก = ปิดหน้าต่าง LIFF นอก LINE
 * = กลับหน้าแรก ทั้งคู่ต้องถามก่อนเพราะข้อมูลที่กรอกจะหาย
 */
export interface LiffLeave {
  leaveOpen: boolean;
  requestLeave: () => void;
  cancelLeave: () => void;
  confirmLeave: () => void;
}

export function useLiffLeave(homePath = '/'): LiffLeave {
  const [leaveOpen, setLeaveOpen] = useState(false);

  const requestLeave = useCallback(() => setLeaveOpen(true), []);
  const cancelLeave = useCallback(() => setLeaveOpen(false), []);

  const confirmLeave = useCallback(() => {
    setLeaveOpen(false);
    if (typeof window !== 'undefined' && window.liff?.isInClient?.() && window.liff.closeWindow) {
      try {
        window.liff.closeWindow();
        return;
      } catch {
        // § ปิดหน้าต่างไม่สำเร็จ — ปล่อยตกไป navigate กลับหน้าแรกด้านล่าง
        // ไม่ return เฉย ๆ เพราะผู้ใช้จะกดยืนยันแล้วไม่มีอะไรเกิดขึ้น
      }
    }
    window.location.href = homePath;
  }, [homePath]);

  return { leaveOpen, requestLeave, cancelLeave, confirmLeave };
}

export function LeaveConfirmDialog({
  isOpen,
  isInLineApp,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  isInLineApp: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isInLineApp ? 'ปิดแบบฟอร์มนี้?' : 'ออกจากหน้านี้?'}</DialogTitle>
          <DialogDescription>
            ข้อมูลที่กรอกไว้ทั้งหมดจะหายไป
            <br />
            และไม่สามารถกู้คืนได้
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3">
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>
            ยืนยัน
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            ไม่ใช่
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
