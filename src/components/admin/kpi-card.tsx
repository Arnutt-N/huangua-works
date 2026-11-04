import Link from 'next/link';
import { cn } from '@/lib/cn';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * KpiCard: Key Performance Indicator card
 *
 * Unity กับ landing Stats: ใช้ glass + icon สีน้ำเงิน/amber + value เด่น
 * แตกต่างจาก Stats ตรงนี้คือเป็น data point เดียว (ไม่ใช่ชุด 4) และทำงานใน admin context
 *
 * Variants:
 *  - default: accent น้ำเงิน (tech/smart)
 *  - gold: amber accent (Thai royal: ใช้สำหรับ highlight KPI)
 *  - danger: red accent (SLA breach / warning)
 *
 * § สีไอคอนใช้ token *-ink ทั้งหมด: ของเดิม variant gold ใช้ text-accent-gold (L82%)
 * บนพื้น gold-soft (L95%) = 1.52:1 ไอคอนแทบหายไปกับพื้น (ต่ำกว่า 3:1 ของ WCAG 1.4.11)
 *
 * โครงการ์ด = กรอบไอคอนสี + ตัวเลข + label เหมือนการ์ดบริการบน landing (Services.tsx)
 * ตั้งใจไม่ใส่แถบสีบนหัวการ์ด: variant สื่อผ่านสีไอคอนอยู่แล้ว การเติมช่องสีที่สอง
 * เป็นการตกแต่งซ้ำที่ landing ไม่ได้ทำ
 *
 * § Interactive Link: เมื่อส่ง `href` จะเรนเดอร์เป็น Next.js `<Link>` พร้อม hover affordance
 * และ focus-visible ring ตาม design tokens เพื่อนำทางไปยังคิวเรื่องที่เกี่ยวข้อง
 */
export type KpiVariant = 'default' | 'gold' | 'success' | 'danger';

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
  success: {
    iconBg: 'bg-success-soft',
    iconColor: 'text-success-ink',
    valueColor: 'text-ink',
  },
  danger: {
    iconBg: 'bg-danger-soft',
    iconColor: 'text-danger-ink',
    valueColor: 'text-danger-ink',
  },
};

export type TrendDirection = 'up' | 'down' | 'flat';

export interface KpiTrend {
  value: string | number;
  direction?: TrendDirection;
  label?: string;
}

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: KpiVariant;
  subtext?: ReactNode;
  trend?: KpiTrend;
  hint?: ReactNode;
  className?: string;
  href?: string;
  ariaLabel?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  subtext,
  trend,
  hint,
  className,
  href,
  ariaLabel,
}: KpiCardProps) {
  const styles = variantStyles[variant];
  const displayValue = typeof value === 'number' ? value.toLocaleString('th-TH') : value;

  const detailNode = trend ? (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          'inline-flex items-center font-bold tabular-nums',
          trend.direction === 'up'
            ? 'text-success-ink'
            : trend.direction === 'down'
              ? 'text-danger-ink'
              : 'text-muted',
        )}
      >
        {trend.direction === 'up' ? '↗ ' : trend.direction === 'down' ? '↘ ' : ''}
        {trend.value}
      </span>
      {trend.label && <span>{trend.label}</span>}
    </span>
  ) : (
    subtext ?? hint
  );

  const content = (
    <>
      <div className="flex items-center gap-3.5 min-w-0">
        <span
          className={cn(
            'flex h-12 w-12 flex-none items-center justify-center rounded-xl shadow-xs transition-transform duration-normal ease-out-expo group-hover:scale-105',
            styles.iconBg,
          )}
        >
          <Icon className={cn('h-6 w-6', styles.iconColor)} aria-hidden="true" />
        </span>
        <div className="flex flex-col min-w-0 justify-center">
          <p className="text-xs font-semibold text-muted truncate leading-normal" title={label}>
            {label}
          </p>
          <p className={cn('mt-0.5 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums leading-tight', styles.valueColor)}>
            {displayValue}
          </p>
          {detailNode && (
            <div className="mt-1 text-xs text-muted truncate leading-normal">
              {detailNode}
            </div>
          )}
        </div>
      </div>
      {href && (
        <ChevronRight
          className="h-4 w-4 flex-none text-muted/50 transition-transform duration-normal ease-out-expo group-hover:translate-x-1 group-hover:text-ink"
          aria-hidden="true"
        />
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel ?? `${label} ${displayValue} คลิกเพื่อดูรายการ`}
        className={cn(
          'glass-panel group flex items-center justify-between gap-3 rounded-2xl p-5 shadow-xs',
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
        'glass-panel flex items-center justify-between gap-3 rounded-2xl p-5 shadow-xs',
        'transition-shadow duration-normal ease-out-expo hover:shadow-md',
        className,
      )}
    >
      {content}
    </div>
  );
}
