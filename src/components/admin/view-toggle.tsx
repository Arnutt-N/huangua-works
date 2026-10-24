'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ViewToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/**
 * ViewToggle — สลับ grid/list (หรือ list/calendar) แบบ segmented
 *
 * § ยกแบบมาจาก jsk ViewToggle.tsx (PR #290) ให้ทุกหน้าใช้สไตล์เดียว
 * สี active ใช้ accent ของหัวงัว ไม่เอา brand-500 ของ jsk
 */
export function ViewToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ViewToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex items-center gap-1 rounded-lg border border-border p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={opt.label}
            aria-label={opt.label}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors',
              active ? 'bg-accent font-medium text-on-accent' : 'text-muted hover:text-ink',
            )}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
