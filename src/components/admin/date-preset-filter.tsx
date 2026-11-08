'use client';

import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ThaiDatePicker } from '@/components/ui/thai-date-picker';
import {
  CUSTOM_RANGE_MESSAGES,
  STANDARD_DATE_PRESETS,
  customRangeProblem,
  type DatePresetOption,
} from '@/lib/date-range';

/**
 * § DatePresetFilter — แถวตัวกรองวันของแอดมิน ตรงกับ JSK หลัง PR #316–#319
 * ปุ่ม preset จริง (7/30/90/ปีนี้) แล้วตามด้วยช่องวันที่สองช่องที่โชว์ตลอด
 * `custom` ไม่มีปุ่ม — ผู้เรียกตั้ง preset เป็น custom เมื่อมีการแก้ช่องวันที่
 * ปุ่มล้างของแถบนี้ชื่อ "ล้างช่วงวัน" เพื่อไม่ชนปุ่ม "ล้างตัวกรอง" ของทั้งฟอร์ม
 */

const FILTER_BUTTON_CLASSES = cn(
  'inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap transition-colors duration-fast',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
  'disabled:pointer-events-none disabled:opacity-50',
);

export interface DatePresetFilterProps {
  /** คีย์ preset ปัจจุบัน เช่น '7d', '30d', '90d', 'year', 'custom' หรือ null */
  preset: string | null;
  customStart: string;
  customEnd: string;
  onPresetChange: (key: string) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  showClear?: boolean;
  onClear?: () => void;
  presets?: DatePresetOption[];
  disabled?: boolean;
  className?: string;
}

export function DatePresetFilter({
  preset,
  customStart,
  customEnd,
  onPresetChange,
  onCustomStartChange,
  onCustomEndChange,
  showClear = false,
  onClear,
  presets = STANDARD_DATE_PRESETS,
  disabled = false,
  className,
}: DatePresetFilterProps) {
  const problem = customRangeProblem(customStart, customEnd);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="ช่วงวันสำเร็จรูป">
          {presets
            .filter((opt) => opt.key !== 'custom')
            .map((opt) => {
              const isActive = preset === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isActive}
                  onClick={() => onPresetChange(opt.key)}
                  className={cn(
                    FILTER_BUTTON_CLASSES,
                    isActive
                      ? 'bg-accent-strong text-on-accent shadow-xs'
                      : 'border border-border bg-surface-raised text-ink hover:bg-accent-sunken hover:text-accent-strong',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-border sm:block" />
          <span className="shrink-0 text-xs text-muted">กำหนดเอง</span>
          <div className="min-w-0 grow basis-48 sm:w-auto sm:grow-0 sm:basis-auto">
            <ThaiDatePicker
              label="จากวันที่"
              placeholder="จากวันที่"
              value={customStart}
              onChange={onCustomStartChange}
              disabled={disabled}
              className="w-full sm:w-52"
            />
          </div>
          <span aria-hidden="true" className="shrink-0 text-xs text-muted">
            ถึง
          </span>
          <div className="min-w-0 grow basis-48 sm:w-auto sm:grow-0 sm:basis-auto">
            <ThaiDatePicker
              label="ถึงวันที่"
              placeholder="ถึงวันที่"
              value={customEnd}
              onChange={onCustomEndChange}
              disabled={disabled}
              className="w-full sm:w-52"
            />
          </div>
        </div>

        {showClear && onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className={cn(
              FILTER_BUTTON_CLASSES,
              'gap-1.5 px-3 text-muted hover:bg-surface-sunken hover:text-ink',
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            ล้างช่วงวัน
          </button>
        )}
      </div>

      {problem && (
        <p role="alert" className="w-full rounded-lg bg-danger/10 p-2 text-xs font-medium text-danger">
          {CUSTOM_RANGE_MESSAGES[problem]}
        </p>
      )}
    </div>
  );
}

export default DatePresetFilter;
