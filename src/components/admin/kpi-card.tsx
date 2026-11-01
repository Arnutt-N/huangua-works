import Link from 'next/link';
import { cn } from '@/lib/cn';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * KpiCard — Key Performance Indicator card
 *
 * Unity กับ landing Stats: ใช้ glass + icon สีน้ำเงิน/amber + value เด่น
 * แตกต่างจาก Stats ตรงนี้คือเป็น data point เดียว (ไม่ใช่ชุด 4) และทำงานใน admin context
 *
 * Variants:
 *  - default: accent น้ำเงิน (tech/smart)
 *  - gold: amber accent (Thai royal — ใช้สำหรับ highlight KPI)
 *  - danger: red accent (SLA breach / warning)
 *
 * § สีไอคอนใช้ token *-ink ทั้งหมด — ของเดิม variant gold ใช้ text-accent-gold (L82%)
 * บนพื้น gold-soft (L95%) = 1.52:1 ไอคอนแทบหายไปกับพื้น (ต่ำกว่า 3:1 ของ WCAG 1.4.11)
 *
 * โครงการ์ด = กรอบไอคอนสี + ตัวเลข + label เหมือนการ์ดบริการบน landing (Services.tsx)
 * ตั้งใจไม่ใส่แถบสีบนหัวการ์ด: variant สื่อผ่านสีไอคอนอยู่แล้ว การเติมช่องสีที่สอง
 * เป็นการตกแต่งซ้ำที่ landing ไม่ได้ทำ
 *
 * § Interactive Link: เมื่อส่ง `href` จะเรนเดอร์เป็น Next.js `<Link>` พร้อม hover affordance
 * และ focus-visible ring ตาม design tokens เพื่อนำทางไปยังคิวเรื่องที่เกี่ยวข้อง
 */
export type KpiVariant = 'default' | 'gold' | 'danger';

const variantStyles: Record<
  KpiVariant,
  { iconBg: string; iconColor: string; valueColor: string }
> = {
  default: {
    iconBg: 'bg-accent-sunken',
    iconColor: 'text-accent-strong',
    valueColor: 'text-ink',
  },
  gold: {
    iconBg: 'bg-accent-gold-soft',
    iconColor: 'text-warning-ink',
    valueColor: 'text-ink',
  },
  danger: {
    iconBg: 'bg-danger-soft',
    iconColor: 'text-danger-ink',
    valueColor: 'text-danger-ink',
  },
};

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: KpiVariant;
  hint?: ReactNode;
  className?: string;
  href?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  hint,
  className,
  href,
}: KpiCardProps) {
  const styles = variantStyles[variant];
  const displayValue = typeof value === 'number' ? value.toLocaleString('th-TH') : value;

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'flex h-11 w-11 flex-none items-center justify-center rounded-md',
            styles.iconBg,
          )}
        >
          <Icon className={cn('h-5 w-5', styles.iconColor)} aria-hidden="true" />
        </span>
        <div className="flex items-center gap-1.5">
          {hint && <span className="text-xs text-muted">{hint}</span>}
          {href && (
            <ChevronRight
              className="h-4 w-4 text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
              aria-hidden="true"
            />
          )}
        </div>
      </div>
      <div>
        <p className={cn('text-3xl font-bold tracking-tight', styles.valueColor)}>
          {displayValue}
        </p>
        <p className="mt-1 text-sm text-muted">{label}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${label} ${displayValue} คลิกเพื่อดูรายการ`}
        className={cn(
          'glass-panel group flex flex-col gap-3 rounded-xl p-5 shadow-sm',
          'transition duration-normal ease-out-expo hover:border-accent-strong hover:shadow-md',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        'glass-panel flex flex-col gap-3 rounded-xl p-5 shadow-sm',
        'transition-shadow duration-normal ease-out-expo hover:shadow-md',
        className,
      )}
    >
      {content}
    </div>
  );
}
