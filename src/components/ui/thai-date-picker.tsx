'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { THAI_MONTHS_FULL } from '@/lib/thai-date';

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
      const probe = new Date(year, month, day);
      if (probe.getFullYear() === year && probe.getMonth() === month && probe.getDate() === day) {
        return { year, month, day };
      }
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

function partsFrom(value: string): { day: string; month: string; year: string } {
  const parsed = parseIsoOrToday(value);
  if (parsed.day === null || !value.trim()) return { day: '', month: '', year: '' };
  return {
    day: String(parsed.day).padStart(2, '0'),
    month: String(parsed.month + 1).padStart(2, '0'),
    year: String(parsed.year + 543),
  };
}

export function ThaiDatePicker({
  id,
  label,
  value,
  onChange,
  disabled = false,
  className,
}: ThaiDatePickerProps) {
  const generatedId = useId();
  const dayId = id ?? generatedId;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const parsed = parseIsoOrToday(value);
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLButtonElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const hasValue = value.trim() !== '';

  function writeParts(iso: string) {
    const parts = partsFrom(iso);
    if (dayRef.current) dayRef.current.value = parts.day;
    if (monthRef.current) monthRef.current.value = parts.month;
    if (yearRef.current) yearRef.current.value = parts.year;
  }

  function openCalendar() {
    if (disabled || hasValue) return;
    const target = parseIsoOrToday(value);
    setViewYear(target.year);
    setViewMonth(target.month);
    setOpen(true);
  }

  function validateAndUpdate() {
    const day = dayRef.current?.value ?? '';
    const month = monthRef.current?.value ?? '';
    const beYear = yearRef.current?.value ?? '';
    setFieldError('');

    if (!day && !month && !beYear) {
      setEditing(false);
      if (value !== '') onChange('');
      return;
    }
    if (!day || !month || !beYear) return;

    const dayNum = Number.parseInt(day, 10);
    const monthNum = Number.parseInt(month, 10);
    const beYearNum = Number.parseInt(beYear, 10);

    if (dayNum < 1 || dayNum > 31) {
      setFieldError('วันที่ไม่ถูกต้อง (1-31)');
      return;
    }
    if (monthNum < 1 || monthNum > 12) {
      setFieldError('เดือนไม่ถูกต้อง (1-12)');
      return;
    }
    if (beYearNum < 2400 || beYearNum > 2700) {
      setFieldError('ปี พ.ศ. ไม่ถูกต้อง (2400-2700)');
      return;
    }

    const ceYear = beYearNum - 543;
    const probe = new Date(ceYear, monthNum - 1, dayNum);
    if (
      probe.getFullYear() !== ceYear ||
      probe.getMonth() !== monthNum - 1 ||
      probe.getDate() !== dayNum
    ) {
      setFieldError('วันที่ไม่มีในเดือนนี้');
      return;
    }

    const iso = toIsoDate(ceYear, monthNum - 1, dayNum);
    setEditing(false);
    if (iso !== value) onChange(iso);
  }

  function handleInput(e: FormEvent<HTMLInputElement>, type: 'day' | 'month' | 'year') {
    setEditing(true);
    setOpen(false);
    const el = e.currentTarget;
    const clean = el.value.replace(/\D/g, '');
    const maxLen = type === 'year' ? 4 : 2;
    el.value = clean.slice(0, maxLen);

    if (type === 'day' && clean.length === 2) {
      monthRef.current?.focus();
      monthRef.current?.select();
    } else if (type === 'month' && clean.length === 2) {
      yearRef.current?.focus();
      yearRef.current?.select();
    }

    if (type === 'year' && clean.length === 4) {
      const dayLen = dayRef.current?.value.length ?? 0;
      const monthLen = monthRef.current?.value.length ?? 0;
      if (dayLen >= 1 && monthLen >= 1) {
        queueMicrotask(() => validateAndUpdate());
      }
    }
  }

  function handleBlur() {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (containerRef.current?.contains(active)) return;
      if (popoverRef.current?.contains(active)) return;
      validateAndUpdate();
    }, 0);
  }

  function clearValue() {
    writeParts('');
    setEditing(false);
    setFieldError('');
    setOpen(false);
    onChange('');
    dayRef.current?.focus();
  }

  useEffect(() => {
    if (editing) return;
    const parts = partsFrom(value);
    if (dayRef.current) dayRef.current.value = parts.day;
    if (monthRef.current) monthRef.current.value = parts.month;
    if (yearRef.current) yearRef.current.value = parts.year;
  }, [value, editing]);

  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;

    function updatePosition() {
      const rect = containerRef.current?.getBoundingClientRect();
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

    function handlePointerDown(e: PointerEvent) {
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
        slotRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function stepMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function commitPicked(iso: string) {
    writeParts(iso);
    setEditing(false);
    setFieldError('');
    onChange(iso);
    setOpen(false);
  }

  function handleSelectDay(day: number) {
    commitPicked(toIsoDate(viewYear, viewMonth, day));
  }

  function handleSelectToday() {
    const now = new Date();
    commitPicked(toIsoDate(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const initial = partsFrom(value);
  const fieldClass =
    'w-8 bg-transparent text-center text-sm text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed';

  return (
    <div className={cn('min-w-0', className)}>
      <div
        ref={containerRef}
        className={cn(
          // § สูง h-9 (36px) ตามช่องวันที่ของ JSK
          'flex h-9 w-full items-center gap-0.5 rounded-xl border border-border bg-surface-raised px-1.5 text-sm text-ink shadow-xs transition-colors duration-fast focus-within:border-accent-strong focus-within:ring-2 focus-within:ring-accent-strong/20',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          ref={dayRef}
          id={dayId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          placeholder="วว"
          defaultValue={initial.day}
          aria-label={label}
          onInput={(e) => handleInput(e, 'day')}
          onBlur={handleBlur}
          className={fieldClass}
        />
        <span className="text-muted" aria-hidden="true">
          /
        </span>
        <input
          ref={monthRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          placeholder="ดด"
          defaultValue={initial.month}
          aria-label={`เดือน ${label}`}
          onInput={(e) => handleInput(e, 'month')}
          onBlur={handleBlur}
          className={fieldClass}
        />
        <span className="text-muted" aria-hidden="true">
          /
        </span>
        <input
          ref={yearRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          placeholder="ปปปป"
          defaultValue={initial.year}
          aria-label={`ปี พ.ศ. ${label}`}
          onInput={(e) => handleInput(e, 'year')}
          onBlur={handleBlur}
          className="w-14 bg-transparent text-center text-sm text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed"
        />

        {/* § ช่องเดียว: ว่างเป็นปุ่มปฏิทิน, มีค่าแล้วเป็นกากบาทวงกลมแดง */}
        {hasValue ? (
          <button
            ref={slotRef}
            type="button"
            disabled={disabled}
            aria-label={`ล้าง${label}`}
            onClick={clearValue}
            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger transition-colors duration-fast hover:bg-danger hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : (
          <button
            ref={slotRef}
            type="button"
            disabled={disabled}
            aria-label={`เปิดปฏิทิน ${label}`}
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={openCalendar}
            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong"
          >
            <CalendarIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {fieldError && (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          {fieldError}
        </p>
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
