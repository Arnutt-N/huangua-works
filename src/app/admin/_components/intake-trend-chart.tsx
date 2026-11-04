'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, ChevronRight, TrendingUp } from 'lucide-react';
import type { DailyTrendPoint } from './admin-dashboard-types';
import { cn } from '@/lib/cn';

export interface IntakeTrendChartProps {
  points: DailyTrendPoint[];
}

type RangeOption = 7 | 30 | 90;

const RANGE_TABS: { label: string; value: RangeOption }[] = [
  { label: '7 วัน', value: 7 },
  { label: '30 วัน', value: 30 },
  { label: '90 วัน', value: 90 },
];

export function IntakeTrendChart({ points }: IntakeTrendChartProps) {
  const [range, setRange] = useState<RangeOption>(30);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradId = useId();

  // กรองข้อมูลตามช่วงเวลาที่เลือก
  const filteredPoints = useMemo(() => {
    if (!points || points.length === 0) return [];
    return points.slice(-range);
  }, [points, range]);

  // พิกัด SVG Geometry (deterministic inline SVG)
  const W = 680;
  const H = 220;
  const PAD_X = 36;
  const PAD_Y = 24;
  const PAD_BOTTOM = 32;

  const chartData = useMemo(() => {
    if (filteredPoints.length === 0) {
      return {
        maxVal: 10,
        areaPath: '',
        intakePath: '',
        resolvedPath: '',
        coords: [],
        totalReceivedInRange: 0,
        totalClosedInRange: 0,
      };
    }

    const maxVal = Math.max(
      1,
      ...filteredPoints.map((p) => Math.max(p.received, p.closed)),
    );

    const stepX = (W - PAD_X * 2) / Math.max(filteredPoints.length - 1, 1);
    const plotH = H - PAD_Y - PAD_BOTTOM;

    const coords = filteredPoints.map((p, i) => {
      const cx = PAD_X + i * stepX;
      const cyReceived = H - PAD_BOTTOM - (p.received / maxVal) * plotH;
      const cyClosed = H - PAD_BOTTOM - (p.closed / maxVal) * plotH;
      return { cx, cyReceived, cyClosed, point: p };
    });

    // สร้าง path สำหรับ Area ของเรื่องรับเข้า
    const intakeLine = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx.toFixed(1)} ${c.cyReceived.toFixed(1)}`)
      .join(' ');

    const baselineY = H - PAD_BOTTOM;
    const firstX = coords[0]?.cx ?? PAD_X;
    const lastX = coords[coords.length - 1]?.cx ?? W - PAD_X;

    const areaPath = coords.length > 0
      ? `${intakeLine} L ${lastX.toFixed(1)} ${baselineY} L ${firstX.toFixed(1)} ${baselineY} Z`
      : '';

    const resolvedLine = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx.toFixed(1)} ${c.cyClosed.toFixed(1)}`)
      .join(' ');

    const totalReceivedInRange = filteredPoints.reduce((sum, p) => sum + p.received, 0);
    const totalClosedInRange = filteredPoints.reduce((sum, p) => sum + p.closed, 0);

    return {
      maxVal,
      areaPath,
      intakePath: intakeLine,
      resolvedPath: resolvedLine,
      coords,
      totalReceivedInRange,
      totalClosedInRange,
    };
  }, [filteredPoints, H, W, PAD_X, PAD_Y, PAD_BOTTOM]);

  const activeCoord = hoveredIndex != null ? chartData.coords[hoveredIndex] : null;

  return (
    <div className="glass-panel flex flex-col justify-between rounded-xl p-5 shadow-sm">
      {/* Top Header & Range Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-sunken text-accent-strong">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="text-base font-bold text-ink">แนวโน้มการรับเรื่องและการแก้ไข</h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            เปรียบเทียบปริมาณเรื่องรับเข้ากับเรื่องที่ดำเนินการปิดสำเร็จ (ย้อนหลัง {range} วัน)
          </p>
        </div>

        {/* Range Tabs (Non-native select filter) */}
        <div
          role="tablist"
          aria-label="เลือกช่วงเวลาแนวโน้ม"
          className="flex items-center gap-1 rounded-lg border border-border bg-surface-sunken p-1 self-start sm:self-auto"
        >
          {RANGE_TABS.map((tab) => {
            const isSelected = range === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setRange(tab.value);
                  setHoveredIndex(null);
                }}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-semibold transition',
                  isSelected
                    ? 'bg-surface-raised text-accent-strong shadow-sm'
                    : 'text-muted hover:text-ink',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Series Summary Badges */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="inline-flex items-center gap-2 rounded-md bg-surface-raised px-2.5 py-1 ring-1 ring-border">
          <span className="h-2.5 w-2.5 rounded-full bg-accent-strong" />
          <span className="text-muted">รับเข้า:</span>
          <span className="font-bold tabular-nums text-ink">
            {chartData.totalReceivedInRange.toLocaleString('th-TH')} เรื่อง
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md bg-surface-raised px-2.5 py-1 ring-1 ring-border">
          <span className="h-0.5 w-3 rounded-full bg-success ring-1 ring-success" />
          <span className="text-muted">ปิดสำเร็จ:</span>
          <span className="font-bold tabular-nums text-success-ink">
            {chartData.totalClosedInRange.toLocaleString('th-TH')} เรื่อง
          </span>
        </div>
      </div>

      {/* SVG Chart Surface */}
      <div className="relative mt-4 overflow-hidden rounded-lg border border-border/70 bg-surface/50 p-2">
        {filteredPoints.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted">
            ยังไม่มีข้อมูลแนวโน้มในช่วงเวลานี้
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-56 w-full min-w-96"
              role="img"
              aria-label={`กราฟแนวโน้ม ${range} วัน รับเข้าทั้งหมด ${chartData.totalReceivedInRange} เรื่อง ปิดสำเร็จ ${chartData.totalClosedInRange} เรื่อง`}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grid Lines (Horizontals) */}
              {[0, 0.33, 0.66, 1].map((t) => {
                const yVal = H - PAD_BOTTOM - t * (H - PAD_Y - PAD_BOTTOM);
                const labelVal = Math.round(chartData.maxVal * t);
                return (
                  <g key={t}>
                    <line
                      x1={PAD_X}
                      x2={W - PAD_X}
                      y1={yVal}
                      y2={yVal}
                      className="stroke-border/70"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={PAD_X - 6}
                      y={yVal + 3}
                      textAnchor="end"
                      className="fill-muted text-xs tabular-nums"
                    >
                      {labelVal}
                    </text>
                  </g>
                );
              })}

              {/* Area path for Received */}
              {chartData.areaPath && (
                <path d={chartData.areaPath} fill={`url(#${gradId})`} />
              )}

              {/* Stroke path for Received (solid accent blue) */}
              {chartData.intakePath && (
                <path
                  d={chartData.intakePath}
                  fill="none"
                  className="stroke-accent-strong"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Stroke path for Resolved (dashed success green) */}
              {chartData.resolvedPath && (
                <path
                  d={chartData.resolvedPath}
                  fill="none"
                  className="stroke-success"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* X Axis Labels */}
              {chartData.coords.map((c, i) => {
                const interval = Math.max(1, Math.floor(chartData.coords.length / 7));
                const isFirst = i === 0;
                const isLast = i === chartData.coords.length - 1;
                const isInterval = i % interval === 0;

                if (!isFirst && !isLast && !isInterval) return null;

                return (
                  <text
                    key={c.point.date}
                    x={c.cx}
                    y={H - 10}
                    textAnchor="middle"
                    className="fill-muted text-xs tabular-nums"
                  >
                    {c.point.label}
                  </text>
                );
              })}

              {/* Active Crosshair Guideline */}
              {activeCoord && (
                <g>
                  <line
                    x1={activeCoord.cx}
                    x2={activeCoord.cx}
                    y1={PAD_Y}
                    y2={H - PAD_BOTTOM}
                    className="stroke-accent-strong"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                  {/* Point marker for received */}
                  <circle
                    cx={activeCoord.cx}
                    cy={activeCoord.cyReceived}
                    r={5}
                    className="fill-surface stroke-accent-strong"
                    strokeWidth={2.5}
                  />
                  {/* Point marker for closed */}
                  <circle
                    cx={activeCoord.cx}
                    cy={activeCoord.cyClosed}
                    r={4.5}
                    className="fill-surface stroke-success"
                    strokeWidth={2}
                  />
                </g>
              )}

              {/* Hover Trigger Rectangles (1 per point for reliable hit testing) */}
              {chartData.coords.map((c, i) => {
                const sliceW = (W - PAD_X * 2) / Math.max(chartData.coords.length, 1);
                return (
                  <rect
                    key={c.point.date}
                    x={c.cx - sliceW / 2}
                    y={0}
                    width={sliceW}
                    height={H}
                    fill="transparent"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onFocus={() => setHoveredIndex(i)}
                    tabIndex={0}
                    role="button"
                    aria-label={`วันที่ ${c.point.label} รับเข้า ${c.point.received} ปิด ${c.point.closed}`}
                    className="cursor-pointer focus:outline-none"
                  />
                );
              })}
            </svg>
          </div>
        )}

        {/* Interactive Tooltip Card Floating on Top */}
        {activeCoord && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-4 py-2 text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted" aria-hidden="true" />
              <span className="font-semibold text-ink">{activeCoord.point.label}</span>
              <span className="text-muted">({activeCoord.point.date})</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-accent-strong">
                รับเข้า: <strong className="tabular-nums">{activeCoord.point.received}</strong> เรื่อง
              </span>
              <span className="text-success-ink">
                ปิดงาน: <strong className="tabular-nums">{activeCoord.point.closed}</strong> เรื่อง
              </span>
              <Link
                href={`/admin/reports?from=${activeCoord.point.date}&to=${activeCoord.point.date}`}
                className="inline-flex items-center gap-1 font-semibold text-accent-strong hover:underline"
              >
                ดูเคสวันนี้ <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        {/* Visually Hidden Accessible Table for Screen Readers */}
        <table className="sr-only">
          <caption>สถิติแนวโน้มการรับเรื่องและปิดงานรายวัน</caption>
          <thead>
            <tr>
              <th scope="col">วันที่</th>
              <th scope="col">รับเข้า (เรื่อง)</th>
              <th scope="col">ปิดสำเร็จ (เรื่อง)</th>
            </tr>
          </thead>
          <tbody>
            {filteredPoints.map((p) => (
              <tr key={p.date}>
                <th scope="row">{p.date}</th>
                <td>{p.received}</td>
                <td>{p.closed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
