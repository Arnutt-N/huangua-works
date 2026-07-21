import type { Metadata } from 'next';
import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  Building2,
  Activity,
} from 'lucide-react';
import { getDb } from '@/lib/db';
import { cases, caseStatsDaily, categories, departments } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminChrome } from '@/components/admin/admin-chrome';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPageTransition } from '@/components/admin/admin-page-transition';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { KpiCard } from '@/components/admin/kpi-card';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { STATUS_LABELS_TH, type CaseStatus } from '@/lib/cases/state-machine';

export const metadata: Metadata = { title: 'รายงานสรุป' };
export const dynamic = 'force-dynamic';

const OPEN_STATUSES: CaseStatus[] = ['received', 'reviewing', 'assigned', 'in_progress'];

export default async function ReportsPage() {
  const { user: staffUser } = await requireStaff();
  const db = await getDb();

  // § ดึง latest stats from case_stats_daily (refresh โดย cron)
  const latest = await firstOrUndefined(
    db.select().from(caseStatsDaily).orderBy(desc(caseStatsDaily.date)).limit(1),
  );

  // § นับ cases by status (live count — ไม่พึ่ง case_stats_daily เพราะอาจเก่า)
  const statusCounts = await db
    .select({ status: cases.status, c: count() })
    .from(cases)
    .groupBy(cases.status);

  const statusMap = new Map<CaseStatus, number>(
    statusCounts.map((r) => [r.status as CaseStatus, Number(r.c)]),
  );
  const totalCases = statusCounts.reduce((sum, r) => sum + Number(r.c), 0);

  // § นับ cases by category (top 10)
  const categoryCounts = await db
    .select({ name: categories.name, c: count() })
    .from(cases)
    .leftJoin(categories, eq(cases.categoryId, categories.id))
    .groupBy(categories.name)
    .orderBy(desc(count()))
    .limit(10);

  // § นับ cases by department
  const deptCounts = await db
    .select({ name: departments.name, c: count() })
    .from(cases)
    .leftJoin(departments, eq(cases.departmentId, departments.id))
    .where(isNotNull(departments.id))
    .groupBy(departments.name)
    .orderBy(desc(count()));

  // § SLA breach count (open + dueDate < now)
  const now = new Date();
  const slaResult = await firstOrUndefined(
    db
      .select({ c: count() })
      .from(cases)
      .where(
        and(
          sql`${cases.status} = ANY (${OPEN_STATUSES})`,
          sql`${cases.dueDate} IS NOT NULL AND ${cases.dueDate} < ${now}`,
        ),
      ),
  );
  const slaBreach = Number(slaResult?.c ?? 0);

  // § KPI values
  const totalReceived = latest?.totalReceived ?? totalCases;
  const totalInProgress =
    latest?.totalInProgress ??
    (statusMap.get('received') ?? 0) +
      (statusMap.get('reviewing') ?? 0) +
      (statusMap.get('assigned') ?? 0) +
      (statusMap.get('in_progress') ?? 0);
  const totalClosed = latest?.totalClosed ?? (statusMap.get('closed') ?? 0);
  const avgResolutionDays = latest?.avgResolutionDays;

  // § สถานะ breakdown สำหรับ bar chart
  const statusBreakdown = (
    [
      'received',
      'reviewing',
      'assigned',
      'in_progress',
      'done',
      'closed',
      'rejected',
    ] as CaseStatus[]
  )
    .map((s) => ({
      status: s,
      count: statusMap.get(s) ?? 0,
      label: STATUS_LABELS_TH[s],
    }))
    .filter((s) => s.count > 0);

  const maxStatusCount = Math.max(1, ...statusBreakdown.map((s) => s.count));

  // § category breakdown สำหรับ bar chart
  const maxCategoryCount = Math.max(1, ...categoryCounts.map((c) => Number(c.c)));

  // § department breakdown
  const maxDeptCount = Math.max(1, ...deptCounts.map((d) => Number(d.c)));

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <AdminChrome user={staffUser} active="reports" />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <AdminPageTransition>
          <div className="space-y-6">
            <AdminPageHeader
              title="รายงานสรุป"
              subtitle={
                latest
                  ? `อัปเดตล่าสุด: ${new Date(latest.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}`
                  : 'สรุปภาพรวมเคสทั้งระบบ (ยังไม่มีข้อมูลรายวัน)'
              }
            />

            {/* KPI cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="เรื่องรับทั้งหมด"
                value={totalReceived}
                icon={TrendingUp}
                variant="default"
              />
              <KpiCard
                label="กำลังดำเนินการ"
                value={totalInProgress}
                icon={Activity}
                variant="gold"
              />
              <KpiCard
                label="ปิดสำเร็จ"
                value={totalClosed}
                icon={CheckCircle2}
                variant="default"
              />
              <KpiCard
                label="เวลาดำเนินการเฉลี่ย"
                value={avgResolutionDays != null ? `${avgResolutionDays} วัน` : '—'}
                icon={Clock}
                variant="default"
              />
            </div>

            {/* SLA alert */}
            {slaBreach > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft/40 px-5 py-4">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-danger-soft">
                  <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-danger">
                    เลยกำหนด SLA {slaBreach.toLocaleString('th-TH')} เรื่อง
                  </p>
                  <p className="text-sm text-muted">
                    เรื่องที่ยังเปิดอยู่และเลยเวลาที่กำหนด — ควรเร่งดำเนินการ
                  </p>
                </div>
              </div>
            )}

            {/* Breakdown by status */}
            <AdminCard>
              <AdminCardTitle icon={<BarChart3 className="h-4 w-4" />}>
                สถิติตามสถานะ
              </AdminCardTitle>
              {statusBreakdown.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">ยังไม่มีข้อมูล</p>
              ) : (
                <ul className="space-y-3">
                  {statusBreakdown.map((item) => (
                    <li key={item.status} className="flex items-center gap-3">
                      <div className="flex w-32 flex-none items-center gap-2">
                        <CaseStatusBadge status={item.status} />
                      </div>
                      <div className="flex-1">
                        <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                          <div
                            className="h-full rounded-full bg-accent transition-all duration-slow ease-out-expo"
                            style={{ width: `${(item.count / maxStatusCount) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-12 flex-none text-right text-sm font-semibold text-ink">
                        {item.count.toLocaleString('th-TH')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Breakdown by category */}
              <AdminCard>
                <AdminCardTitle icon={<FolderTree className="h-4 w-4" />}>
                  10 หมวดยอดนิยม
                </AdminCardTitle>
                {categoryCounts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">ยังไม่มีข้อมูล</p>
                ) : (
                  <ul className="space-y-3">
                    {categoryCounts.map((item, i) => (
                      <li key={item.name ?? `unknown-${i}`} className="flex items-center gap-3">
                        <span className="w-32 flex-none truncate text-sm text-ink" title={item.name ?? 'ไม่ระบุ'}>
                          {item.name ?? 'ไม่ระบุ'}
                        </span>
                        <div className="flex-1">
                          <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                            <div
                              className="h-full rounded-full bg-accent-gold transition-all duration-slow ease-out-expo"
                              style={{ width: `${(Number(item.c) / maxCategoryCount) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-10 flex-none text-right text-sm font-semibold text-ink">
                          {Number(item.c).toLocaleString('th-TH')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </AdminCard>

              {/* Breakdown by department */}
              <AdminCard>
                <AdminCardTitle icon={<Building2 className="h-4 w-4" />}>
                  ตามหน่วยงานรับผิดชอบ
                </AdminCardTitle>
                {deptCounts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">
                    ยังไม่มีเรื่องที่มอบหมายหน่วยงาน
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {deptCounts.map((item, i) => (
                      <li key={item.name ?? `unknown-${i}`} className="flex items-center gap-3">
                        <span className="w-32 flex-none truncate text-sm text-ink" title={item.name ?? 'ไม่ระบุ'}>
                          {item.name ?? 'ไม่ระบุ'}
                        </span>
                        <div className="flex-1">
                          <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                            <div
                              className="h-full rounded-full bg-accent transition-all duration-slow ease-out-expo"
                              style={{ width: `${(Number(item.c) / maxDeptCount) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-10 flex-none text-right text-sm font-semibold text-ink">
                          {Number(item.c).toLocaleString('th-TH')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </AdminCard>
            </div>
          </div>
        </AdminPageTransition>
      </main>
    </div>
  );
}
