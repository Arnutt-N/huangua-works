'use client';

import { ThaiDatePicker } from '@/components/ui/thai-date-picker';
import { toLocalDatetimeInputValue } from './rich-menu-state';

/**
 * วันที่ (พ.ศ.) + เวลา รวมเป็น ISO เดียว
 * § <input type="datetime-local"> แสดง ค.ศ. — ใช้ ThaiDatePicker คู่กับ time input
 * แล้วค่อยประกอบ ISO เฉพาะเมื่อได้ทั้งวันและเวลา
 */
export function ThaiDateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (nextIso: string | null) => void;
}) {
  const local = toLocalDatetimeInputValue(value);
  const datePart = local.slice(0, 10);
  const timePart = local.slice(11, 16);

  function emit(nextDate: string, nextTime: string) {
    if (!nextDate || !nextTime) {
      onChange(null);
      return;
    }
    const d = new Date(`${nextDate}T${nextTime}`);
    onChange(Number.isNaN(d.getTime()) ? null : d.toISOString());
  }

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <ThaiDatePicker
          label={`${label} วันที่`}
          value={datePart}
          onChange={(next) => emit(next, timePart || '00:00')}
          className="w-full sm:w-40"
        />
        <input
          type="time"
          aria-label={`${label} เวลา`}
          value={timePart}
          onChange={(e) => {
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            emit(datePart || today, e.target.value);
          }}
          className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-ink sm:w-32"
        />
      </div>
    </div>
  );
}
