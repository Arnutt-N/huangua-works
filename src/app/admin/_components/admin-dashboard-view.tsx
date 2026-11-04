'use client';

import Link from 'next/link';
import {
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  FileSpreadsheet,
  Award,
} from 'lucide-react';
import { KpiCard } from '@/components/admin/kpi-card';
import { IntakeTrendChart } from './intake-trend-chart';
import { StatusDonutChart } from './status-donut-chart';
import { CategoryRankedChart } from './category-ranked-chart';
import { LifecycleStackedBar } from './lifecycle-stacked-bar';
import { DepartmentAttributionTable } from './department-attribution-table';
import type {
  DailyTrendPoint,
  StatusBreakdownItem,
  CategoryBreakdownItem,
  DepartmentBreakdownItem,
  DashboardMetrics,
} from './admin-dashboard-types';
import { cn } from '@/lib/cn';

export interface AdminDashboardViewProps {
  metrics: DashboardMetrics;
  trendPoints: DailyTrendPoint[];
  statusBreakdown: StatusBreakdownItem[];
  categoryBreakdown: CategoryBreakdownItem[];
  departmentBreakdown: DepartmentBreakdownItem[];
}

export function AdminDashboardView({
  metrics,
  trendPoints,
  statusBreakdown,
  categoryBreakdown,
  departmentBreakdown,
}: AdminDashboardViewProps) {
  const totalReceivedFormatted = metrics.totalReceived.toLocaleString('th-TH');

  return (
    <div className="space-y-6">
      {/* Freshness Timestamp line */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          {metrics.lastUpdatedDateText}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/reports/pmqa"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-accent-strong hover:text-accent-strong"
          >
            <Award className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
            รายงานเกณฑ์ PMQA
          </Link>
          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-accent-strong hover:text-accent-strong"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
            ตารางจัดการเรื่อง
          </Link>
        </div>
      </div>

      {/* SLA Alert Banner (Prominent Callout) */}
      {metrics.slaBreach > 0 && (
        <Link
          href="/admin/reports?overdue=1"
          aria-label={`เลยกำหนด SLA ${metrics.slaBreach.toLocaleString('th-TH')} เรื่อง คลิกเพื่อดูคิวเรื่อง`}
          className={cn(
            'group flex items-center justify-between gap-3 rounded-xl border border-danger-ink/30 bg-danger-soft px-5 py-4 shadow-sm transition',
            'hover:border-danger-ink hover:bg-danger-soft/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-ink',
          )}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-danger-soft ring-1 ring-danger-ink/30 ring-inset">
              <AlertTriangle className="h-5 w-5 text-danger-ink" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold text-danger-ink">
                เลยกำหนด SLA {metrics.slaBreach.toLocaleString('th-TH')} เรื่อง
              </p>
              <p className="text-xs text-ink/80">
                เรื่องร้องเรียนที่ยังเปิดอยู่และเลยกำหนดระยะเวลาแก้ไขตามมาตรฐาน (คลิกเพื่อเปิดดูคิวเรื่องที่ต้องเร่งดำเนินการ)
              </p>
            </div>
          </div>
          <ChevronRight
            className="h-5 w-5 text-danger-ink transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      )}

      {/* BAND 1: Leading Hero Section (Hero Metric + Trend Chart) */}
      <div className="grid gap-6 lg:grid-cols-12 items-stretch">
        {/* Leading Metric Card (Col 4) */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-xl border border-border bg-surface-raised p-6 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-sunken text-accent-strong">
                <TrendingUp className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="inline-flex items-center rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-semibold text-accent-strong">
                ภาพรวมทั้งระบบ
              </span>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                เรื่องรับทั้งหมด
              </p>
              {/* Display Type at 3x body size */}
              <p className="mt-1 text-4xl sm:text-5xl font-black tabular-nums tracking-tight text-ink">
                {totalReceivedFormatted}
              </p>
            </div>

            <div className="mt-4 space-y-2 border-t border-border/60 pt-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted">อัตราการแก้ไขเสร็จสิ้น:</span>
                <span className="font-bold text-success-ink tabular-nums">
                  {metrics.resolutionRate}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">รับเข้า 7 วันล่าสุด:</span>
                <span className="font-bold text-accent-strong tabular-nums">
                  +{metrics.recentIntakeVelocity.toLocaleString('th-TH')} เรื่อง
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="/admin/reports"
              aria-label={`เรื่องรับทั้งหมด ${totalReceivedFormatted} คลิกเพื่อดูรายการ`}
              className={cn(
                'group flex w-full items-center justify-center gap-2 rounded-lg bg-accent-strong px-4 py-2.5 text-xs font-semibold text-on-accent shadow-sm transition',
                'hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
              )}
            >
              <span>ดูรายการเรื่องทั้งหมด</span>
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* 30-Day Intake & Resolution Trend Area Chart (Col 8) */}
        <div className="lg:col-span-8 flex flex-col">
          <IntakeTrendChart points={trendPoints} />
        </div>
      </div>

      {/* BAND 2: Secondary Operational Figures */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="กำลังดำเนินการ"
          value={metrics.totalInProgress}
          icon={Activity}
          variant="gold"
          className="shadow-accent-drop"
          href="/admin/reports?status=open"
        />
        <KpiCard
          label="ปิดสำเร็จ"
          value={metrics.totalClosed}
          icon={CheckCircle2}
          variant="default"
          href="/admin/reports?status=closed"
        />
        <KpiCard
          label="เวลาดำเนินการเฉลี่ย"
          value={metrics.avgResolutionDays != null ? `${metrics.avgResolutionDays} วัน` : '-'}
          icon={Clock}
          variant="default"
        />
      </div>

      {/* BAND 3: Multi-Chart Visual Analytics (Donut + Ranked Horizontal Bars) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6 flex flex-col">
          <StatusDonutChart
            items={statusBreakdown}
            totalCases={metrics.totalReceived}
          />
        </div>
        <div className="lg:col-span-6 flex flex-col">
          <CategoryRankedChart categories={categoryBreakdown} />
        </div>
      </div>

      {/* BAND 4: Lifecycle Stacked Progression & Department Table */}
      <div className="space-y-6">
        <LifecycleStackedBar
          statusItems={statusBreakdown}
          totalCases={metrics.totalReceived}
        />

        <DepartmentAttributionTable departments={departmentBreakdown} />
      </div>

      {/* BAND 5: Ending on Purpose (Operational Footer) */}
      <div className="rounded-xl border border-border/80 bg-surface-sunken/60 px-5 py-4 text-xs text-muted">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span>ระบบประมวลผลข้อมูลอัตโนมัติ (Cron Refresh ทุกเที่ยงคืน)</span>
          </div>
          <p>
            อบต.หัวงัว อ.ยางตลาด จ.กาฬสินธุ์ • ระบบรับเรื่องร้องเรียนและบริการประชาชน
          </p>
        </div>
      </div>
    </div>
  );
}
