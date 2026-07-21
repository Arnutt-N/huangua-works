import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * KpiCard — Key Performance Indicator card
 *
 * Unity กับ landing Stats: ใช้ glass + icon สี emerald/amber + value เด่น
 * แตกต่างจาก Stats ตรงนี้คือเป็น data point เดียว (ไม่ใช่ชุด 4) และทำงานใน admin context
 *
 * Variants:
 *  - default: emerald accent (tech/smart)
 *  - gold: amber accent (Thai royal — ใช้สำหรับ highlight KPI)
 *  - danger: red accent (SLA breach / warning)
 */
type KpiVariant = 'default' | 'gold' | 'danger';

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
    iconColor: 'text-accent-gold',
    valueColor: 'text-ink',
  },
  danger: {
    iconBg: 'bg-danger-soft',
    iconColor: 'text-danger',
    valueColor: 'text-danger',
  },
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  hint,
  className,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: KpiVariant;
  hint?: ReactNode;
  className?: string;
}) {
  const styles = variantStyles[variant];
  const displayValue = typeof value === 'number' ? value.toLocaleString('th-TH') : value;

  return (
    <div
      className={cn(
        'glass flex flex-col gap-3 rounded-lg p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-md',
            styles.iconBg,
          )}
        >
          <Icon className={cn('h-5 w-5', styles.iconColor)} aria-hidden="true" />
        </span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      <div>
        <p className={cn('text-3xl font-bold tracking-tight', styles.valueColor)}>
          {displayValue}
        </p>
        <p className="mt-1 text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}
