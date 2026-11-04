'use client';

import Link from 'next/link';
import {
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Award,
  ShieldCheck,
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

      {/* BAND 1: Key Performance Indicators (4 การ์ดสถิติเรียงหน้ากระดานสไตล์ Horizontal Split) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="เรื่องรับทั้งหมด"
          value={metrics.totalReceived}
          icon={TrendingUp}
          variant="default"
          href="/admin/reports"
          trend={
            metrics.monthOverMonthTrend ?? {
              value: `+${metrics.recentIntakeVelocity.toLocaleString('th-TH')}`,
              direction: metrics.recentIntakeVelocity > 0 ? 'up' : 'flat',
              label: 'รับเข้า 7 วันล่าสุด',
            }
          }
        />
        <KpiCard
          label="กำลังดำเนินการ"
          value={metrics.totalInProgress}
          icon={Activity}
          variant="gold"
          className="shadow-accent-drop"
          href="/admin/reports?status=open"
          subtext={
            metrics.totalReceived > 0
              ? `สัดส่วน ${Math.round((metrics.totalInProgress / metrics.totalReceived) * 100)}% ของทั้งหมด`
              : 'ไม่มีเรื่องค้างดำเนินการ'
          }
        />
        <KpiCard
          label="ปิดสำเร็จ"
          value={metrics.totalClosed}
          icon={CheckCircle2}
          variant="success"
          href="/admin/reports?status=closed"
          subtext={
            metrics.avgResolutionDays != null
              ? `สำเร็จ ${metrics.resolutionRate}% (เฉลี่ย ${metrics.avgResolutionDays} วัน)`
              : `สำเร็จ ${metrics.resolutionRate}%`
          }
        />
        <KpiCard
          label="เลยกำหนด SLA"
          value={metrics.slaBreach}
          icon={metrics.slaBreach > 0 ? AlertTriangle : ShieldCheck}
          variant={metrics.slaBreach > 0 ? 'danger' : 'success'}
          href={metrics.slaBreach > 0 ? '/admin/reports?overdue=1' : undefined}
          ariaLabel={
            metrics.slaBreach > 0
              ? `เลยกำหนด SLA ${metrics.slaBreach.toLocaleString('th-TH')} เรื่อง คลิกเพื่อดูคิวเรื่อง`
              : undefined
          }
          subtext={metrics.slaBreach > 0 ? 'เกินกำหนดมาตรฐาน ต้องเร่งรัด' : 'ตรงตามเกณฑ์ 100%'}
        />
      </div>

      {/* BAND 2: 30-Day Intake & Resolution Trend Area Chart */}
      <div className="flex flex-col">
        <IntakeTrendChart points={trendPoints} />
      </div>

      {/* BAND 3: Multi-Chart Visual Analytics (Donut + Ranked Horizontal Bars) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6 flex flex-col">
          <StatusDonutChart items={statusBreakdown} />
        </div>
        <div className="lg:col-span-6 flex flex-col">
          <CategoryRankedChart categories={categoryBreakdown} />
        </div>
      </div>

      {/* BAND 4: Lifecycle Stacked Progression & Department Table */}
      <div className="space-y-6">
        <LifecycleStackedBar statusItems={statusBreakdown} />

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
