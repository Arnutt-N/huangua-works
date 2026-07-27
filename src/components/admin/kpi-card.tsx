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
 *
 * § สีไอคอนใช้ token *-ink ทั้งหมด — ของเดิม variant gold ใช้ text-accent-gold (L82%)
 * บนพื้น gold-soft (L95%) = 1.52:1 ไอคอนแทบหายไปกับพื้น (ต่ำกว่า 3:1 ของ WCAG 1.4.11)
 */
type KpiVariant = 'default' | 'gold' | 'danger';

const variantStyles: Record<
  KpiVariant,
  { iconBg: string; iconColor: string; valueColor: string; rule: string }
> = {
  default: {
    iconBg: 'bg-accent-sunken',
    iconColor: 'text-accent-strong',
    valueColor: 'text-ink',
    rule: 'bg-accent',
  },
  gold: {
    iconBg: 'bg-accent-gold-soft',
    iconColor: 'text-warning-ink',
    valueColor: 'text-ink',
    rule: 'bg-accent-gold',
  },
  danger: {
    iconBg: 'bg-danger-soft',
    iconColor: 'text-danger-ink',
    valueColor: 'text-danger-ink',
    rule: 'bg-danger',
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
        'glass-panel relative flex flex-col gap-3 overflow-hidden rounded-xl p-5 shadow-sm',
        'transition-shadow duration-normal ease-out-expo hover:shadow-md',
        className,
      )}
    >
      {/* แถบสีบนหัวการ์ด — บอก variant ได้ทันทีโดยไม่ต้องพึ่งสีไอคอนอย่างเดียว */}
      <span
        className={cn('absolute inset-x-0 top-0 h-1', styles.rule)}
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'flex h-11 w-11 flex-none items-center justify-center rounded-md',
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
