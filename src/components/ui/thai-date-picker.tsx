'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatIsoToThaiShort, THAI_MONTHS_FULL } from '@/lib/thai-date';

const WEEKDAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;
const POPOVER_WIDTH = 280;
const POPOVER_EST_HEIGHT = 320;
const VIEWPORT_PADDING = 8;

export interface ThaiDatePickerProps {
  id?: string;
  label: string;
  value: string;
  onChange: (nextIsoDate: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function parseIsoOrToday(value: string): { year: number; month: number; day: number | null } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: null };
}

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function ThaiDatePicker({
  id,
  label,
  value,
  onChange,
  placeholder = 'เลือกวันที่',
  disabled = false,
  className,
}: ThaiDatePickerProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;

  const [open, setOpen] = useState(false);
  const parsed = parseIsoOrToday(value);
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function openCalendar() {
    if (disabled) return;
    const target = parseIsoOrToday(value);
    setViewYear(target.year);
    setViewMonth(target.month);
    setOpen((prev) => !prev);
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = rect.left;
      if (left + POPOVER_WIDTH + VIEWPORT_PADDING > vw) {
        left = Math.max(VIEWPORT_PADDING, vw - POPOVER_WIDTH - VIEWPORT_PADDING);
      }

      let top = rect.bottom + 6;
      if (top + POPOVER_EST_HEIGHT > vh && rect.top - POPOVER_EST_HEIGHT - 6 > VIEWPORT_PADDING) {
        top = rect.top - POPOVER_EST_HEIGHT - 6;
      }

      setCoords({ top, left });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function stepMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function handleSelectDay(day: number) {
    onChange(toIsoDate(viewYear, viewMonth, day));
    setOpen(false);
  }

  function handleSelectToday() {
    const now = new Date();
    onChange(toIsoDate(now.getFullYear(), now.getMonth(), now.getDate()));
    setOpen(false);
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const displayText = formatIsoToThaiShort(value);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex min-h-touch w-full items-center gap-1 rounded-md border border-border bg-surface-raised px-2.5 text-sm text-ink shadow-xs transition-colors duration-fast focus-within:border-accent-strong focus-within:ring-2 focus-within:ring-accent-strong/20 sm:w-52',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={openCalendar}
        className="flex min-h-touch min-w-0 flex-1 items-center gap-2 text-left outline-none"
      >
        <CalendarIcon className="h-4 w-4 flex-none text-muted" aria-hidden="true" />
        <span className={cn('truncate', displayText ? 'text-ink' : 'text-muted')}>
          {displayText || placeholder}
        </span>
      </button>

      {displayText && !disabled && (
        <button
          type="button"
          aria-label={`ล้าง${label}`}
          onClick={() => {
            onChange('');
            setOpen(false);
          }}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={`ปฏิทิน ${label}`}
            style={{ top: coords.top, left: coords.left, width: POPOVER_WIDTH }}
            className="fixed z-50 rounded-xl border border-border bg-surface-raised p-3 shadow-overlay"
          >
            <div className="mb-2 flex items-center justify-between gap-1">
              <button
                type="button"
                aria-label="เดือนก่อนหน้า"
                onClick={() => stepMonth(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-sunken hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-sm font-semibold text-ink">
                {THAI_MONTHS_FULL[viewMonth]} {viewYear + 543}
              </span>
              <button
                type="button"
                aria-label="เดือนถัดไป"
                onClick={() => stepMonth(1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-sunken hover:text-ink"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted">
              {WEEKDAYS_TH.map((w) => (
                <span key={w} className="py-1">
                  {w}
                </span>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (day === null) {
                  return <span key={`empty-${idx}`} className="h-8 w-8" aria-hidden="true" />;
                }
                const iso = toIsoDate(viewYear, viewMonth, day);
                const isSelected = iso === value;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors duration-fast',
                      isSelected
                        ? 'bg-accent-strong font-semibold text-on-accent'
                        : 'text-ink hover:bg-accent-sunken hover:text-accent-strong',
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <button
                type="button"
                onClick={handleSelectToday}
                className="text-xs font-semibold text-accent-strong hover:underline"
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted hover:text-ink"
              >
                ปิด
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
