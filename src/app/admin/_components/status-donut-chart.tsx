'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PieChart, ChevronRight } from 'lucide-react';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import type { StatusBreakdownItem } from './admin-dashboard-types';
import type { CaseStatus } from '@/lib/cases/state-machine';
import { cn } from '@/lib/cn';

export interface StatusDonutChartProps {
  items: StatusBreakdownItem[];
}

interface SegmentData {
  status: CaseStatus;
  label: string;
  count: number;
  percentage: number;
  dashArray: string;
  dashOffset: number;
  colorVar: string;
}

// สี semantic ตามกลุ่มสถานะ
function getStatusColor(status: CaseStatus): string {
  switch (status) {
    case 'pending':
    case 'received':
      return 'var(--color-accent)';
    case 'reviewing':
    case 'assigned':
      return 'var(--color-accent-gold)';
    case 'in_progress':
      return 'var(--color-warning)';
    case 'done':
    case 'closed':
      return 'var(--color-success)';
    case 'rejected':
      return 'var(--color-danger)';
    default:
      return 'var(--color-muted)';
  }
}

export function StatusDonutChart({ items }: StatusDonutChartProps) {
  const [activeStatus, setActiveStatus] = useState<CaseStatus | null>(null);

  // Geometry คำนวณ donut
  const RADIUS = 64;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~402.12
  const STROKE_WIDTH = 22;

  const validItems = useMemo(() => items.filter((it) => it.count > 0), [items]);
  const maxCount = useMemo(
    () => Math.max(1, ...validItems.map((it) => it.count)),
    [validItems],
  );
  // § ตัวหารต้องเป็นผลรวมของชิ้นที่วาด ห้ามรับยอดจากภายนอก — เดิมใช้
  // metrics.totalReceived ซึ่งเป็น snapshot รายวัน (เช่น 1) ขณะที่รายสถานะรวมได้ 274
  // ชิ้น "เสร็จสิ้น" จึงยาวเกินเส้นรอบวงแล้วทับชิ้นอื่นจนโดนัทเป็นวงเขียวทึบ
  const totalCases = useMemo(
    () => validItems.reduce((sum, it) => sum + it.count, 0),
    [validItems],
  );

  const segments = useMemo<SegmentData[]>(() => {
    if (totalCases <= 0 || validItems.length === 0) return [];

    let currentOffset = 0;
    return validItems.map((item) => {
      const percentage = (item.count / totalCases) * 100;
      const segmentLength = (item.count / totalCases) * CIRCUMFERENCE;
      const dashArray = `${segmentLength.toFixed(2)} ${(CIRCUMFERENCE - segmentLength).toFixed(2)}`;
      const dashOffset = -currentOffset;
      currentOffset += segmentLength;

      return {
        status: item.status,
        label: item.label,
        count: item.count,
        percentage,
        dashArray,
        dashOffset,
        colorVar: getStatusColor(item.status),
      };
    });
  }, [validItems, totalCases, CIRCUMFERENCE]);

  const activeSegment = segments.find((s) => s.status === activeStatus) ?? null;

  return (
    <div className="glass-panel @container flex flex-col justify-between rounded-xl p-5 shadow-sm">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-sunken text-accent-strong">
            <PieChart className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-base font-bold text-ink">สัดส่วนตามสถานะเรื่อง</h2>
        </div>
        <Link
          href="/admin/reports"
          className="text-xs font-semibold text-accent-strong hover:underline"
        >
          ดูทั้งหมด
        </Link>
      </div>

      {validItems.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted">
          ยังไม่มีข้อมูลสถานะเรื่องร้องเรียน
        </div>
      ) : (
        <div className="mt-4 grid items-center gap-6 @3xl:grid-cols-12">
          {/* § วางคู่กันเมื่อการ์ดกว้างถึง @3xl (768px) — การ์ดนี้เต็มแถวแดชบอร์ด
              จอแคบยังเรียงวงไว้เหนือรายการ เพื่อไม่ให้ป้ายยาวทับแถบ */}
          {/* Donut Visual (Col 5) */}
          <div className="relative flex flex-col items-center justify-center @3xl:col-span-5">
            <div className="relative h-44 w-44">
              <svg
                viewBox="0 0 160 160"
                className="h-full w-full -rotate-90 transform"
                role="img"
                aria-label={`โดนัทชาร์ตสัดส่วนสถานะเรื่องทั้งหมด ${totalCases} เรื่อง`}
              >
                {/* Background Track Circle */}
                <circle
                  cx="80"
                  cy="80"
                  r={RADIUS}
                  fill="none"
                  className="stroke-border/50"
                  strokeWidth={STROKE_WIDTH}
                />

                {/* Slices */}
                {segments.map((seg) => {
                  const isHovered = activeStatus === seg.status;
                  return (
                    <circle
                      key={seg.status}
                      cx="80"
                      cy="80"
                      r={RADIUS}
                      fill="none"
                      stroke={seg.colorVar}
                      strokeWidth={isHovered ? STROKE_WIDTH + 4 : STROKE_WIDTH}
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                      strokeLinecap="butt"
                      className="transition-all duration-normal ease-out-expo cursor-pointer"
                      onMouseEnter={() => setActiveStatus(seg.status)}
                      onMouseLeave={() => setActiveStatus(null)}
                      onFocus={() => setActiveStatus(seg.status)}
                      onBlur={() => setActiveStatus(null)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${seg.label} ${seg.count} เรื่อง (${seg.percentage.toFixed(1)}%)`}
                    />
                  );
                })}
              </svg>

              {/* Center Metric Display */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black tabular-nums tracking-tight text-ink">
                  {activeSegment ? activeSegment.count.toLocaleString('th-TH') : totalCases.toLocaleString('th-TH')}
                </span>
                <span
                  className="pointer-events-auto max-w-24 truncate text-xs font-semibold text-muted"
                  title={activeSegment ? activeSegment.label : 'เรื่องทั้งหมด'}
                >
                  {activeSegment ? activeSegment.label : 'เรื่องทั้งหมด'}
                </span>
                {activeSegment && (
                  <span className="text-xs font-bold text-accent-strong">
                    {activeSegment.percentage.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            <p className="mt-2 text-center text-xs text-muted">
              {activeSegment ? `สัดส่วน: ${activeSegment.label}` : 'ชี้ที่วงกลมเพื่อดูสัดส่วน'}
            </p>
          </div>

          {/* Interactive Status List (Col 7) */}
          <div className="min-w-0 @3xl:col-span-7">
            <ul className="space-y-2">
              {validItems.map((item) => {
                const isHovered = activeStatus === item.status;
                return (
                  <li key={item.status}>
                    <Link
                      href={`/admin/reports?status=${item.status}`}
                      aria-label={`ดูเรื่องสถานะ ${item.label} จำนวน ${item.count} เรื่อง`}
                      onMouseEnter={() => setActiveStatus(item.status)}
                      onMouseLeave={() => setActiveStatus(null)}
                      className={cn(
                        'group flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg p-2 transition',
                        'hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
                        isHovered && 'bg-surface-raised ring-1 ring-border',
                      )}
                    >
                      <CaseStatusBadge status={item.status} className="shrink-0" />

                      <div className="min-w-16 flex-1">
                        <div className="h-2 overflow-hidden rounded-pill bg-ink/10 ring-1 ring-ink/5 ring-inset">
                          <div
                            className={cn(
                              'h-full rounded-pill transition-all duration-slow ease-out-expo',
                              item.status === 'done' || item.status === 'closed'
                                ? 'bg-success-ink'
                                : item.status === 'rejected'
                                  ? 'bg-danger-ink'
                                  : item.status === 'in_progress'
                                    ? 'bg-warning-ink'
                                    : 'bg-accent-strong',
                            )}
                            style={{ width: `${(item.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>

                      <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-ink group-hover:text-accent-strong">
                        {item.count.toLocaleString('th-TH')}
                      </span>

                      <ChevronRight
                        className={cn(
                          'h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink',
                          isHovered ? 'opacity-100' : 'opacity-60',
                        )}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
