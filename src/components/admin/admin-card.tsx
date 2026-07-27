import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

/**
 * AdminCard — พื้นผิวการ์ดสำหรับ content grouping
 *
 * ค่าเริ่มต้นคือ .glass-panel (โปร่ง 86% + blur) วางทับ mesh-gradient ของ AdminShell
 * → ได้ภาษา glassmorphism เดียวกับการ์ดบน landing แต่ทึบพอให้ตาราง/ตัวเลขอ่านชัด
 * (.glass ที่ 70% ของ landing บางเกินไปสำหรับหน้าที่ข้อมูลหนาแน่น)
 *
 * `variant`:
 *  - 'glass'  (default) — การ์ดทั่วไปบนพื้น mesh
 *  - 'solid'  — พื้นทึบเต็ม สำหรับ nested card (การ์ดซ้อนการ์ด glass ซ้อนกันจะขุ่น)
 */
export function AdminCard({
  children,
  className,
  variant = 'glass',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'glass' | 'solid';
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <Tag
      className={cn(
        'rounded-xl p-5 shadow-sm transition-shadow duration-normal ease-out-expo',
        variant === 'glass'
          ? 'glass-panel'
          : 'border border-border bg-surface-raised',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * AdminCardTitle — title ของ section ใน card (consistent typography)
 *
 * ไอคอนอยู่ในกรอบ accent-sunken ให้เป็นจุดนำสายตาแบบเดียวกับการ์ดบริการบน landing
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
      <h2 className="flex min-w-0 items-center gap-2.5 text-base font-bold text-ink">
        {icon && (
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-accent-sunken text-accent-strong">
            {icon}
          </span>
        )}
        <span className="truncate">{children}</span>
      </h2>
      {action && <div className="flex flex-none items-center gap-2">{action}</div>}
    </div>
  );
}
