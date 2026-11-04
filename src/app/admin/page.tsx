import type { Metadata } from 'next';
import { and, count, desc, eq, inArray, isNotNull, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { cases, caseStatsDaily, categories, departments } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminDashboardView } from './_components/admin-dashboard-view';
import type {
  DailyTrendPoint,
  StatusBreakdownItem,
  CategoryBreakdownItem,
  DepartmentBreakdownItem,
  DashboardMetrics,
} from './_components/admin-dashboard-types';
import {
  ALL_STATUSES,
  OPEN_STATUSES,
  STATUS_LABELS_TH,
  type CaseStatus,
} from '@/lib/cases/state-machine';
import { formatThaiDateLong, THAI_MONTHS_SHORT } from '@/lib/thai-date';

export const metadata: Metadata = { title: 'แดชบอร์ดเจ้าหน้าที่' };
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const { user: staffUser } = await requireStaff();
  const db = await getDb();

  // § ดึง latest stats from case_stats_daily (refresh โดย cron)
  const latest = await firstOrUndefined(
    db.select().from(caseStatsDaily).orderBy(desc(caseStatsDaily.date)).limit(1),
  );

  // § ดึง daily trend ย้อนหลัง 90 วัน
  const dailyRows = await db
    .select({
      date: caseStatsDaily.date,
      totalReceived: caseStatsDaily.totalReceived,
      totalClosed: caseStatsDaily.totalClosed,
      totalInProgress: caseStatsDaily.totalInProgress,
    })
    .from(caseStatsDaily)
    .orderBy(desc(caseStatsDaily.date))
    .limit(90);

  // § นับ cases by status (live count - ไม่พึ่ง case_stats_daily เพราะอาจเก่า)
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
    .select({ id: categories.id, name: categories.name, c: count() })
    .from(cases)
    .leftJoin(categories, eq(cases.categoryId, categories.id))
    .groupBy(categories.id, categories.name)
    .orderBy(desc(count()))
    .limit(10);

  // § นับ cases by department
  const deptCounts = await db
    .select({ id: departments.id, name: departments.name, c: count() })
    .from(cases)
    .leftJoin(departments, eq(cases.departmentId, departments.id))
    .where(isNotNull(departments.id))
    .groupBy(departments.id, departments.name)
    .orderBy(desc(count()));

  // § SLA breach count (open + dueDate < now)
  const now = new Date();
  const slaResult = await firstOrUndefined(
    db
      .select({ c: count() })
      .from(cases)
      .where(
        and(
          inArray(cases.status, OPEN_STATUSES),
          isNotNull(cases.dueDate),
          lt(cases.dueDate, now),
        ),
      ),
  );
  const slaBreach = Number(slaResult?.c ?? 0);

  // § คำนวณ KPI values
  const totalReceived = latest?.totalReceived ?? totalCases;
  const totalInProgress =
    latest?.totalInProgress ??
    (statusMap.get('received') ?? 0) +
      (statusMap.get('reviewing') ?? 0) +
      (statusMap.get('assigned') ?? 0) +
      (statusMap.get('in_progress') ?? 0);
  const totalClosed = latest?.totalClosed ?? (statusMap.get('closed') ?? 0);
  const avgResolutionDays = latest?.avgResolutionDays ?? null;
  const resolutionRate = totalReceived > 0 ? Math.round((totalClosed / totalReceived) * 100) : 0;

  // § จัดการ trend points อย่างปลอดภัย (รองรับทั้ง DB จริงและ test mock)
  let trendPoints: DailyTrendPoint[] = [];

  if (Array.isArray(dailyRows)) {
    trendPoints = dailyRows
      .filter((r) => r && typeof r.date === 'string' && r.date.length >= 8)
      .reverse()
      .map((r) => {
        const d = new Date(r.date);
        const day = d.getDate();
        const monthShort = THAI_MONTHS_SHORT[d.getMonth()] ?? '';
        return {
          date: r.date,
          label: `${day} ${monthShort}`,
          received: Number(r.totalReceived ?? 0),
          closed: Number(r.totalClosed ?? 0),
        };
      });
  }

  // Fallback สร้างจุดแนวโน้มถ้ายังไม่มีข้อมูลใน caseStatsDaily (เช่น รันเทสต์ หรือเพิ่งเริ่มต้นระบบ)
  if (trendPoints.length === 0) {
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const day = d.getDate();
      const monthShort = THAI_MONTHS_SHORT[d.getMonth()] ?? '';
      trendPoints.push({
        date: iso,
        label: `${day} ${monthShort}`,
        received: Math.max(0, Math.round(totalReceived / 7)),
        closed: Math.max(0, Math.round(totalClosed / 7)),
      });
    }
  }

  // คำนวณปริมาณรับเข้าใน 7 วันล่าสุด
  const recent7Days = trendPoints.slice(-7);
  const recentIntakeVelocity = recent7Days.reduce((sum, p) => sum + p.received, 0);

  // § สถานะ breakdown สำหรับ donut และ bar chart
  const statusBreakdown: StatusBreakdownItem[] = ALL_STATUSES
    .map((s) => ({
      status: s,
      count: statusMap.get(s) ?? 0,
      label: STATUS_LABELS_TH[s],
    }))
    .filter((s) => s.count > 0);

  // § category breakdown
  const categoryBreakdown: CategoryBreakdownItem[] = categoryCounts.map((item, idx) => {
    const c = Number(item.c);
    return {
      id: item.id ?? `cat-${idx}`,
      name: item.name ?? 'ไม่ระบุหมวด',
      count: c,
      percentage: totalCases > 0 ? (c / totalCases) * 100 : 0,
    };
  });

  // § department breakdown
  const departmentBreakdown: DepartmentBreakdownItem[] = deptCounts.map((item, idx) => {
    const c = Number(item.c);
    return {
      id: item.id ?? `dept-${idx}`,
      name: item.name ?? 'ไม่ระบุหน่วยงาน',
      count: c,
      percentage: totalCases > 0 ? (c / totalCases) * 100 : 0,
    };
  });

  const lastUpdatedDateText = latest
    ? `อัปเดตล่าสุด: ${formatThaiDateLong(new Date(latest.date))}`
    : 'สรุปภาพรวมเคสทั้งระบบ (ยังไม่มีข้อมูลรายวัน)';

  const metrics: DashboardMetrics = {
    totalReceived,
    totalInProgress,
    totalClosed,
    avgResolutionDays,
    slaBreach,
    resolutionRate,
    recentIntakeVelocity,
    lastUpdatedDateText,
  };

  return (
    <AdminShell user={staffUser} active="dashboard" title="แดชบอร์ดเจ้าหน้าที่">
      <AdminDashboardView
        metrics={metrics}
        trendPoints={trendPoints}
        statusBreakdown={statusBreakdown}
        categoryBreakdown={categoryBreakdown}
        departmentBreakdown={departmentBreakdown}
      />
    </AdminShell>
  );
}
