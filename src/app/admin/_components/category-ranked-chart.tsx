'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { FolderTree, ChevronRight } from 'lucide-react';
import type { CategoryBreakdownItem } from './admin-dashboard-types';
import { cn } from '@/lib/cn';

export interface CategoryRankedChartProps {
  categories: CategoryBreakdownItem[];
}

export function CategoryRankedChart({ categories }: CategoryRankedChartProps) {
  const maxCount = useMemo(
    () => Math.max(1, ...categories.map((c) => c.count)),
    [categories],
  );

  return (
    <div className="glass-panel flex flex-col justify-between rounded-xl p-5 shadow-sm">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-sunken text-accent-strong">
            <FolderTree className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-base font-bold text-ink">10 หมวดยอดนิยม</h2>
        </div>
        <Link
          href="/admin/reports"
          className="text-xs font-semibold text-accent-strong hover:underline"
        >
          คัดกรองทั้งหมด
        </Link>
      </div>

      {categories.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted">
          ยังไม่มีข้อมูลหมวดหมู่เรื่องร้องเรียน
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {categories.map((item, idx) => {
            const rank = idx + 1;
            const barWidthPercent = (item.count / maxCount) * 100;
            const targetHref = item.id
              ? `/admin/reports?category=${item.id}`
              : '/admin/reports';

            return (
              <li key={item.id ?? `cat-${idx}`}>
                <Link
                  href={targetHref}
                  aria-label={`หมวด ${item.name} อันดับ ${rank} จำนวน ${item.count} เรื่อง`}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg p-2 transition',
                    'hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
                  )}
                >
                  {/* Rank Badge */}
                  <span
                    className={cn(
                      'flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold tabular-nums',
                      rank <= 3
                        ? 'bg-accent-gold-soft text-warning-ink ring-1 ring-accent-gold/40'
                        : 'bg-surface-sunken text-muted ring-1 ring-border',
                    )}
                  >
                    {rank}
                  </span>

                  {/* Category Name */}
                  <span
                    className="w-28 sm:w-36 flex-none truncate text-xs font-medium text-ink group-hover:text-accent-strong"
                    title={item.name}
                  >
                    {item.name}
                  </span>

                  {/* Horizontal Bar with Fill */}
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-pill bg-ink/10 ring-1 ring-ink/5 ring-inset">
                      <div
                        className="h-full rounded-pill bg-accent-strong transition-all duration-slow ease-out-expo group-hover:bg-accent"
                        style={{ width: `${barWidthPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Count & Share */}
                  <div className="flex w-16 flex-none items-center justify-end gap-1 text-right text-xs">
                    <span className="font-bold tabular-nums text-ink group-hover:text-accent-strong">
                      {item.count.toLocaleString('th-TH')}
                    </span>
                    <span className="text-xs text-muted">
                      ({item.percentage.toFixed(0)}%)
                    </span>
                  </div>

                  {/* Chevron drilldown indicator */}
                  <ChevronRight
                    className="h-4 w-4 flex-none text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
