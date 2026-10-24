import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * PageHeader — h1 + subtitle + ปุ่ม action ชิดขวาบน
 *
 * § ยกแบบมาจาก jsk PageHeader.tsx เพื่อให้ทุกหน้าเมนู LINE ได้โครงหน้าเดียวกับ
 * ต้นฉบับ (เดิม huangua ย้ายชื่อหน้าไป topbar ของ AdminShell แล้วหัวเนื้อหาเป็น
 * AdminCardTitle ทำให้รูปทรงหน้าไม่ตรง screenshot ตั้งแต่บรรทัดแรก)
 * สีใช้ token หัวงัว (text-ink/text-muted) ไม่เอา navy ของ jsk
 */
export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{children}</div>}
    </div>
  );
}
