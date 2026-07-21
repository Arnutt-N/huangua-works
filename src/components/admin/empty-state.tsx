import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * EmptyState — สถานะไม่มีข้อมูล สำหรับ list/table
 *
 * ใช้ icon + message + optional action
 * สอดคล้องกับ muted text tokens (ไม่ใช่ danger — ไม่มีข้อมูลไม่ใช่ error)
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-sunken">
        <Icon className="h-7 w-7 text-accent-strong" aria-hidden="true" />
      </span>
      <p className="mt-4 text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
