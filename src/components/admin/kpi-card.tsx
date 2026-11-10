import Link from 'next/link';
import { cn } from '@/lib/cn';
import { ClipText } from '@/components/ui/tooltip';
import type { LucideIcon } from 'lucide-react';
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
 *  - success: green accent (เสร็จสิ้น / ตรงตาม SLA 100%)
 *  - danger: red accent (SLA breach / warning)
 *
 * § สีไอคอนใช้ token *-ink ทั้งหมด: ของเดิม variant gold ใช้ text-accent-gold (L82%)
 * บนพื้น gold-soft (L95%) = 1.52:1 ไอคอนแทบหายไปกับพื้น (ต่ำกว่า 3:1 ของ WCAG 1.4.11)
 *
 * § โครงสร้าง Horizontal Split (ตาม TaskFlow design reference):
 * 1. Icon Container: ใช้ `rounded-md` (12px token) เพื่อให้เป็นสี่เหลี่ยมลบมุม (squircle)
 *    ห้ามใช้ `rounded-xl` เพราะใน tokens.css กำหนด `--radius-xl: 24px` ซึ่งบนกล่อง 48px (h-12 w-12)
 *    จะกลายเป็นวงกลมสมบูรณ์
 * 2. Vertical Alignment: ใช้ `items-start` เพื่อตรึงไอคอนให้อยู่แนวบนสุดเสมอ
 *    ไอคอนทุกใบในแถวหน้ากระดานจะเรียงเสมอกันที่ขอบบน แม้บางการ์ดจะมี subtext หรือไม่มีก็ตาม
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

  const innerContent = (
    <>
      <span
        className={cn(
          'flex h-12 w-12 flex-none items-center justify-center rounded-md shadow-xs transition-transform duration-normal ease-out-expo group-hover:scale-105',
          styles.iconBg,
        )}
      >
        <Icon className={cn('h-6 w-6', styles.iconColor)} aria-hidden="true" />
      </span>
      <div className="flex flex-col min-w-0">
        <ClipText className="text-xs font-semibold leading-normal text-muted">{label}</ClipText>
        <p className={cn('mt-0.5 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums leading-tight', styles.valueColor)}>
          {displayValue}
        </p>
        {detailNode && (
          <ClipText className="mt-1 text-xs leading-normal text-muted">{detailNode}</ClipText>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel ?? `${label} ${displayValue} คลิกเพื่อดูรายการ`}
        className={cn(
          'glass-panel group flex items-start gap-3.5 rounded-2xl p-5 shadow-xs',
          'transition duration-normal ease-out-expo hover:border-accent-strong hover:shadow-md',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
          className,
        )}
      >
        {innerContent}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        'glass-panel flex items-start gap-3.5 rounded-2xl p-5 shadow-xs',
        'transition-shadow duration-normal ease-out-expo hover:shadow-md',
        className,
      )}
    >
      {innerContent}
    </div>
  );
}
