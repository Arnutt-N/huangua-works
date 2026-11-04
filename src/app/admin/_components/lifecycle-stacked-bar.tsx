'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Layers, ChevronRight, CheckCircle2, Clock, Inbox, Wrench } from 'lucide-react';
import type { StatusBreakdownItem } from './admin-dashboard-types';
import { cn } from '@/lib/cn';

export interface LifecycleStackedBarProps {
  statusItems: StatusBreakdownItem[];
  totalCases: number;
}

interface StageInfo {
  id: string;
  label: string;
  icon: typeof Inbox;
  count: number;
  percentage: number;
  colorClass: string;
  bgSoftClass: string;
  textInkClass: string;
  filterHref: string;
}

export function LifecycleStackedBar({ statusItems, totalCases }: LifecycleStackedBarProps) {
  const [activeStage, setActiveStage] = useState<string | null>(null);

  const stages = useMemo<StageInfo[]>(() => {
    const map = new Map(statusItems.map((s) => [s.status, s.count]));

    const intakeCount = (map.get('pending') ?? 0) + (map.get('received') ?? 0);
    const screeningCount = (map.get('reviewing') ?? 0) + (map.get('assigned') ?? 0);
    const progressCount = map.get('in_progress') ?? 0;
    const resolvedCount = (map.get('done') ?? 0) + (map.get('closed') ?? 0);

    const safeTotal = Math.max(1, totalCases);

    return [
      {
        id: 'intake',
        label: '1. รับเรื่องใหม่',
        icon: Inbox,
        count: intakeCount,
        percentage: (intakeCount / safeTotal) * 100,
        colorClass: 'bg-accent-strong',
        bgSoftClass: 'bg-accent-sunken',
        textInkClass: 'text-accent-strong',
        filterHref: '/admin/reports?status=received',
      },
      {
        id: 'screening',
        label: '2. ตรวจสอบ/มอบหมาย',
        icon: Clock,
        count: screeningCount,
        percentage: (screeningCount / safeTotal) * 100,
        colorClass: 'bg-accent-gold',
        bgSoftClass: 'bg-accent-gold-soft',
        textInkClass: 'text-warning-ink',
        filterHref: '/admin/reports?status=assigned',
      },
      {
        id: 'in_progress',
        label: '3. กำลังดำเนินการ',
        icon: Wrench,
        count: progressCount,
        percentage: (progressCount / safeTotal) * 100,
        colorClass: 'bg-warning-ink',
        bgSoftClass: 'bg-warning-soft',
        textInkClass: 'text-warning-ink',
        filterHref: '/admin/reports?status=in_progress',
      },
      {
        id: 'closed',
        label: '4. ดำเนินการเสร็จสิ้น',
        icon: CheckCircle2,
        count: resolvedCount,
        percentage: (resolvedCount / safeTotal) * 100,
        colorClass: 'bg-success',
        bgSoftClass: 'bg-success-soft',
        textInkClass: 'text-success-ink',
        filterHref: '/admin/reports?status=closed',
      },
    ];
  }, [statusItems, totalCases]);

  return (
    <div className="glass-panel flex flex-col justify-between rounded-xl p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-sunken text-accent-strong">
            <Layers className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-base font-bold text-ink">วงจรขั้นตอนการดำเนินงาน (Lifecycle Funnel)</h2>
        </div>
        <span className="text-xs text-muted">
          สัดส่วนเรื่องตาม 4 ลำดับขั้นตอนการจัดการ
        </span>
      </div>

      {totalCases === 0 ? (
        <div className="mt-4 flex h-24 items-center justify-center text-sm text-muted">
          ยังไม่มีข้อมูลในวงจรขั้นตอน
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Stacked Horizontal Bar */}
          <div
            className="flex h-3 w-full overflow-hidden rounded-pill bg-ink/10 ring-1 ring-ink/5 ring-inset"
            role="img"
            aria-label={`สัดส่วนวงจรเรื่อง รับเรื่อง ${stages[0]?.percentage.toFixed(0)}%, ตรวจสอบ ${stages[1]?.percentage.toFixed(0)}%, กำลังดำเนินการ ${stages[2]?.percentage.toFixed(0)}%, เสร็จสิ้น ${stages[3]?.percentage.toFixed(0)}%`}
          >
            {stages.map((stage) => {
              if (stage.percentage <= 0) return null;
              const isHovered = activeStage === stage.id;
              return (
                <div
                  key={stage.id}
                  className={cn(
                    'h-full transition-all duration-normal ease-out-expo border-r border-surface last:border-r-0',
                    stage.colorClass,
                    isHovered && 'brightness-110 filter',
                  )}
                  style={{ width: `${Math.max(1, stage.percentage)}%` }}
                  title={`${stage.label}: ${stage.count} เรื่อง (${stage.percentage.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          {/* Stage Detail Cards / Chips */}
          <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
            {stages.map((stage) => {
              const Icon = stage.icon;
              const isHovered = activeStage === stage.id;
              return (
                <Link
                  key={stage.id}
                  href={stage.filterHref}
                  onMouseEnter={() => setActiveStage(stage.id)}
                  onMouseLeave={() => setActiveStage(null)}
                  className={cn(
                    'group flex flex-col justify-between rounded-lg border border-border p-3 transition',
                    'hover:border-accent-strong hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
                    isHovered && 'bg-surface-raised ring-1 ring-accent-strong',
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <Icon className={cn('h-3.5 w-3.5', stage.textInkClass)} aria-hidden="true" />
                      {stage.label}
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-lg font-bold tabular-nums text-ink">
                      {stage.count.toLocaleString('th-TH')}
                    </span>
                    <span className="text-xs font-semibold text-muted">
                      {stage.percentage.toFixed(1)}%
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
