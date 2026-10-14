'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { updateQueueBooking, type QueueActionState } from '@/app/admin/actions/queue';
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

  if (next.length === 0) {
    return <span className="text-sm text-muted">—</span>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={bookingId} />
      <label className="sr-only" htmlFor={`queue-status-${bookingId}`}>
        เปลี่ยนสถานะคิว
      </label>
      <select
        id={`queue-status-${bookingId}`}
        name="status"
        defaultValue={next[0]}
        className="min-h-touch rounded-md border border-border bg-surface-raised px-3 text-sm text-ink"
      >
        {next.map((s) => (
          <option key={s} value={s}>
            {QUEUE_BOOKING_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`queue-note-${bookingId}`}>
        โน้ตภายใน
      </label>
      <input
        id={`queue-note-${bookingId}`}
        name="adminNote"
        type="text"
        aria-label="โน้ตภายใน"
        defaultValue={currentNote ?? ''}
        placeholder="โน้ตภายใน (ถ้ามี)"
        maxLength={500}
        className="min-h-touch w-40 rounded-md border border-border bg-surface-raised px-3 text-sm text-ink placeholder:text-muted"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'กำลังบันทึก…' : 'บันทึก'}
      </Button>
      {state.error && (
        <p role="alert" className="w-full text-sm font-semibold text-danger-ink">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="w-full text-sm font-semibold text-success-ink">
          {state.success}
        </p>
      )}
    </form>
  );
}
