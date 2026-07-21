import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

/**
 * AdminCard — surface-raised card สำหรับ content grouping
 *
 * สอดคล้องกับ tokens.css §radius-md (12px) + §border (hairline)
 * ไม่ใช้ glass โดย default (admin ต้องการ contrast ชัดสำหรับ data)
 * ใช้ glass variant เฉพาะ KPI/summary cards
 */
export function AdminCard({
  children,
  className,
  glass = false,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  glass?: boolean;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <Tag
      className={cn(
        'rounded-lg border p-5 transition-colors duration-normal ease-out-expo',
        glass ? 'glass border-transparent' : 'border-border bg-surface-raised',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * AdminCardTitle — title ของ section ใน card (consistent typography)
 */
export function AdminCardTitle({
  children,
  icon,
  action,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
        {icon && <span className="text-accent-strong">{icon}</span>}
        {children}
      </h2>
      {action}
    </div>
  );
}
