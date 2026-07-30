'use client';

import { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label, Textarea } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StaffMember } from '../_lib/types';

export function TransferDialog({
  open,
  onOpenChange,
  staff,
  currentOwnerId,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffMember[];
  /** เจ้าของห้องปัจจุบัน — ตัดออกจากรายชื่อปลายทาง */
  currentOwnerId: string | null;
  onConfirm: (toAdminId: string, reason?: string) => Promise<boolean>;
}) {
  const [toAdminId, setToAdminId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect -- reset ฟอร์มทุกครั้งที่เปิด dialog */
      setToAdminId('');
      setReason('');
      setSubmitting(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  const candidates = staff.filter((s) => s.id !== currentOwnerId);

  const handleConfirm = async () => {
    if (!toAdminId || submitting) return;
    setSubmitting(true);
    const ok = await onConfirm(toAdminId, reason.trim() || undefined);
    setSubmitting(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>โอนแชทให้เจ้าหน้าที่ท่านอื่น</DialogTitle>
          <DialogDescription>
            ห้องนี้จะย้ายไปอยู่ในความดูแลของเจ้าหน้าที่ที่เลือก และบันทึกประวัติการโอนไว้
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="transfer-target">โอนให้</Label>
            <Select value={toAdminId} onValueChange={setToAdminId}>
              <SelectTrigger id="transfer-target" aria-label="เลือกเจ้าหน้าที่ปลายทาง">
                <SelectValue placeholder="เลือกเจ้าหน้าที่..." />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName ?? s.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidates.length === 0 && (
              <p className="mt-1.5 text-sm text-muted">ไม่มีเจ้าหน้าที่ท่านอื่นให้โอน</p>
            )}
          </div>

          <div>
            <Label htmlFor="transfer-reason">เหตุผล (ไม่บังคับ)</Label>
            <Textarea
              id="transfer-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น เรื่องอยู่ในความรับผิดชอบของกองช่าง"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!toAdminId || submitting}
            onClick={() => void handleConfirm()}
          >
            <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
            {submitting ? 'กำลังโอน...' : 'ยืนยันโอนแชท'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
