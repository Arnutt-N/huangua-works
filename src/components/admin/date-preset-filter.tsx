'use client';

import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ThaiDatePicker } from '@/components/ui/thai-date-picker';
import { STANDARD_DATE_PRESETS, type DatePresetOption } from '@/lib/date-range';

/**
 * § DatePresetFilter — คอมโพเนนต์เลือกช่วงวันสำเร็จรูปสำหรับระบบแอดมิน (Tranche F / JSK Port)
 * - ปุ่ม Preset: วันนี้, 7 วัน, 30 วัน, ปีงบประมาณนี้, กำหนดเอง
 * - Touch Target ≥ 44px (`min-h-touch`) ตามเกณฑ์ WCAG 2.2 / A11Y-05
 * - ใช้ ThaiDatePicker (พ.ศ.) ในโหมด "กำหนดเอง"
 */

export interface DatePresetFilterProps {
  /** คีย์ preset ปัจจุบัน เช่น 'today', '7d', '30d', 'fiscal', 'custom' หรือ null */
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

/** แถวปุ่ม Preset อย่างเดียว (สำหรับใช้ในแถบตัวกรองที่จัด layout พิเศษ) */
export function DatePresetButtons({
  preset,
  onPresetChange,
  presets = STANDARD_DATE_PRESETS,
  disabled = false,
}: Pick<DatePresetFilterProps, 'preset' | 'onPresetChange' | 'presets' | 'disabled'>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="ช่วงวันสำเร็จรูป">
      {presets.map((opt) => {
        const isActive = preset === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onPresetChange(opt.key)}
            className={cn(
              'inline-flex min-h-touch cursor-pointer items-center justify-center rounded-md px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-fast',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
              'disabled:pointer-events-none disabled:opacity-50',
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
  );
}

/** คอมโพเนนต์ตัวกรองวันที่พร้อมแถบ Preset + ThaiDatePicker + ปุ่มล้าง */
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
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <DatePresetButtons
        preset={preset}
        onPresetChange={onPresetChange}
        presets={presets}
        disabled={disabled}
      />

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <ThaiDatePicker
            label="ตั้งแต่วันที่"
            placeholder="ตั้งแต่วันที่"
            value={customStart}
            onChange={onCustomStartChange}
            disabled={disabled}
          />
          <span className="text-xs text-muted" aria-hidden="true">
            ถึง
          </span>
          <ThaiDatePicker
            label="ถึงวันที่"
            placeholder="ถึงวันที่"
            value={customEnd}
            onChange={onCustomEndChange}
            disabled={disabled}
          />
        </div>
      )}

      {showClear && onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label="ล้างวันที่"
          className="inline-flex min-h-touch cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong disabled:pointer-events-none disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          ล้างวันที่
        </button>
      )}
    </div>
  );
}

export default DatePresetFilter;
