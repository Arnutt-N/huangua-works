'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateQueueBooking, type QueueActionState } from '@/app/admin/actions/queue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  QUEUE_BOOKING_STATUS_LABELS,
  type QueueBookingStatus,
} from '@/lib/validation';

/** สถานะปลายทางที่เลือกได้จากสถานะปัจจุบัน — ตัวกรองฝั่ง UI เท่านั้น server ตรวจซ้ำเสมอ */
const NEXT_STATUSES: Record<QueueBookingStatus, QueueBookingStatus[]> = {
  booked: ['confirmed', 'cancelled'],
  confirmed: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};

const initialState: QueueActionState = { error: null };

export function QueueRowForm({
  bookingId,
  currentStatus,
  currentNote,
}: {
  bookingId: string;
  currentStatus: QueueBookingStatus;
  currentNote: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateQueueBooking, initialState);
  const next = NEXT_STATUSES[currentStatus];
  const [status, setStatus] = useState<QueueBookingStatus>(next[0] ?? 'confirmed');
  const [showCancelWarning, setShowCancelWarning] = useState(false);

  if (next.length === 0) {
    return <span className="text-sm text-muted">—</span>;
  }

  function handleStatusChange(val: string) {
    const nextStatus = val as QueueBookingStatus;
    setStatus(nextStatus);
    setShowCancelWarning(nextStatus === 'cancelled');
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <input type="hidden" name="id" value={bookingId} />
      <input type="hidden" name="status" value={status} />

      <div className="w-full sm:w-36">
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger aria-label="เปลี่ยนสถานะคิว">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {next.map((s) => (
              <SelectItem key={s} value={s}>
                {QUEUE_BOOKING_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <input
        id={`queue-note-${bookingId}`}
        name="adminNote"
        type="text"
        aria-label="โน้ตภายใน"
        defaultValue={currentNote ?? ''}
        placeholder={status === 'cancelled' ? 'ระบุเหตุผลการยกเลิก' : 'โน้ตภายใน (ถ้ามี)'}
        maxLength={500}
        className={`min-h-touch w-full rounded-md border bg-surface-raised px-3 text-sm text-ink placeholder:text-muted sm:w-48 ${
          status === 'cancelled' ? 'border-danger-ink/40' : 'border-border'
        }`}
      />

      <Button
        type="submit"
        size="sm"
        variant={status === 'cancelled' ? 'destructive' : 'primary'}
        disabled={pending}
      >
        {pending ? 'กำลังบันทึก…' : 'บันทึก'}
      </Button>

      {showCancelWarning && (
        <p className="w-full text-xs font-semibold text-danger-ink">
          ข้อควรระวัง: การยกเลิกคิวจะแจ้งเตือนไปยังประชาชนทาง LINE กรุณาระบุเหตุผลในช่องโน้ต
        </p>
      )}

      {state.error && (
        <p role="alert" className="w-full text-xs font-semibold text-danger-ink">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="w-full text-xs font-semibold text-success-ink">
          {state.success}
        </p>
      )}
    </form>
  );
}
