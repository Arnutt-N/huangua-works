import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

/**
 * AdminPageHeader — ส่วนหัวของทุก admin page
 *
 * Unity กับ landing: ใช้ mesh-gradient accent เป็นพื้นหลังเล็กๆ ที่หัว (subtle)
 * ไม่ใช่ hero เต็มจอ — เพียงพอให้รู้สึกว่าเป็น product เดียวกัน
 *
 * Layout: title + subtitle ซ้าย, optional action ขวา (เช่น ปุ่ม "เพิ่มผู้ใช้")
 */
export function AdminPageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-surface-raised px-5 py-4 sm:px-6 sm:py-5',
        className,
      )}
    >
      {/* subtle mesh accent — unity กับ landing แต่ไม่เป็นจุดโฟกัส */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'radial-gradient(at 12% 18%, oklch(55% 0.13 160) 0px, transparent 50%), radial-gradient(at 88% 12%, oklch(82% 0.14 80) 0px, transparent 50%)',
        }}
        aria-hidden="true"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {action && <div className="flex flex-none items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
