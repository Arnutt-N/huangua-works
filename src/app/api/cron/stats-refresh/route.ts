/**
 * GET /api/cron/stats-refresh — refresh case_stats_daily (เรียกทุก 00:00)
 * คำนวณสถิติรายวันแล้วเก็บเข้า case_stats_daily table
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { caseStatsDaily } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { requireCron } from '@/lib/cron-auth';
import { bangkokDateKey } from '@/lib/cases/stats';
import { isDailySnapshot } from '@/lib/cases/stats';
import { OPEN_STATUSES, type CaseStatus } from '@/lib/cases/state-machine';

interface AggregateRow {
  [key: string]: unknown;
  statuses: Record<string, string | number> | null;
  avgResolutionDays: string | number | null;
  byDepartment: Record<string, string | number> | null;
  byCategory: Record<string, string | number> | null;
  dailyArrivals: string | number;
  dailyClosures: string | number;
}

function numberFrom(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  const auth = requireCron(req);
  if (!auth.ok) return auth.response;

  const db = await getDb();
  // § วันที่ต้องตรงกับเขตเวลากรุงเทพ — new Date().toISOString() ผิดหลัง 17:00 น.
  const today = bangkokDateKey(new Date());

  // § รวมทุก aggregator ใน query เดียวจาก snapshot เดียวกัน: ไม่ transfer description/attachments
  // และไม่ให้ status/duration/group ต่าง database state
  const rows = await db.execute<AggregateRow>(sql`
    WITH status_counts AS (
      SELECT status, count(*)::int AS c FROM cases GROUP BY status
    ),
    durations AS (
      -- § floor รายเรื่องก่อนเฉลี่ย (legacy null treatment) แล้วปัดผลรวมเหมือน Math.round เดิม
      SELECT round(avg(floor(extract(epoch FROM (closed_at - created_at)) / 86400)))::int AS avg_days
      FROM cases
      WHERE status = 'closed' AND closed_at IS NOT NULL
    ),
    dept_counts AS (
      SELECT department_id, count(*)::int AS c FROM cases
      WHERE department_id IS NOT NULL GROUP BY department_id
    ),
    cat_counts AS (
      SELECT category_id, count(*)::int AS c FROM cases GROUP BY category_id
    )
    SELECT
      (SELECT coalesce(jsonb_object_agg(status, c), '{}'::jsonb) FROM status_counts) AS statuses,
      (SELECT avg_days FROM durations) AS "avgResolutionDays",
      (SELECT coalesce(jsonb_object_agg(department_id, c), '{}'::jsonb) FROM dept_counts) AS "byDepartment",
      (SELECT coalesce(jsonb_object_agg(category_id, c), '{}'::jsonb) FROM cat_counts) AS "byCategory",
      (SELECT count(*)::int FROM cases WHERE created_at >= ${today}::date::timestamp - interval '7 hours'
        AND created_at < (${today}::date + 1)::timestamp - interval '7 hours') AS "dailyArrivals",
      (SELECT count(*)::int FROM cases WHERE closed_at >= ${today}::date::timestamp - interval '7 hours'
        AND closed_at < (${today}::date + 1)::timestamp - interval '7 hours') AS "dailyClosures"
  `);
  const row = rows[0];
  if (!row) throw new Error('stats aggregation returned no row');

  const countByStatus: Partial<Record<CaseStatus, number>> = {};
  for (const [status, value] of Object.entries(row.statuses ?? {})) {
    countByStatus[status as CaseStatus] = numberFrom(value);
  }
  const totalCases = Object.values(countByStatus).reduce((sum, n) => sum + (n ?? 0), 0);
  const closedCount = countByStatus.closed ?? 0;
  const rejectedCount = countByStatus.rejected ?? 0;
  const inProgressCount = OPEN_STATUSES.reduce((sum, status) => sum + (countByStatus[status] ?? 0), 0);
  const avgResolutionDays = row.avgResolutionDays === null ? null : numberFrom(row.avgResolutionDays);
  const dailyArrivals = numberFrom(row.dailyArrivals);
  const dailyClosures = numberFrom(row.dailyClosures);
  const toCounts = (value: Record<string, string | number> | null): Record<string, number> =>
    Object.fromEntries(Object.entries(value ?? {}).map(([key, n]) => [key, numberFrom(n)]));

  const metadata = {
    refreshedAt: new Date().toISOString(),
    totalCases,
    // § ยอดสะสมแยกจากยอดรายวันในคอลัมน์ — snapshot เก่าไม่มี field นี้ caller ต้อง fallback
    statusCounts: {
      received: countByStatus.received ?? 0,
      closed: closedCount,
      rejected: rejectedCount,
      inProgress: inProgressCount,
    },
  };

  // § atomic upsert — สอง cron ที่ทับกันต้องจบที่แถวเดียวโดยไม่ unique violation
  await db
    .insert(caseStatsDaily)
    .values({
      id: generateId(),
      date: today,
      totalReceived: dailyArrivals,
      totalClosed: dailyClosures,
      totalRejected: rejectedCount,
      totalInProgress: inProgressCount,
      avgResolutionDays,
      byDepartment: toCounts(row.byDepartment),
      byCategory: toCounts(row.byCategory),
      metadata,
    })
    .onConflictDoUpdate({
      target: caseStatsDaily.date,
      set: {
        totalReceived: dailyArrivals,
        totalClosed: dailyClosures,
        totalRejected: rejectedCount,
        totalInProgress: inProgressCount,
        avgResolutionDays,
        byDepartment: toCounts(row.byDepartment),
        byCategory: toCounts(row.byCategory),
        metadata,
      },
    });

  // § ปิดยอดวันก่อนหน้าเมื่อรันวันใหม่ — เคสที่เข้าหรือปิดหลังรอบเช้าของวันนั้นจะถูกเก็บ
  //   ให้ครบในยอดสุดท้ายของวันนั้น (ข้อ 6) เขียนเฉพาะแถวที่มี metadata รุ่นใหม่
  const yesterday = bangkokDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const [prev] = await db
    .select({ id: caseStatsDaily.id, metadata: caseStatsDaily.metadata })
    .from(caseStatsDaily)
    .where(eq(caseStatsDaily.date, yesterday))
    .limit(1);
  if (prev && isDailySnapshot(prev.metadata)) {
    const prevRows = await db.execute<AggregateRow>(sql`
      WITH status_counts AS (
        SELECT status, count(*)::int AS c FROM cases GROUP BY status
      ),
      durations AS (
        SELECT round(avg(floor(extract(epoch FROM (closed_at - created_at)) / 86400)))::int AS avg_days
        FROM cases
        WHERE status = 'closed' AND closed_at IS NOT NULL
      ),
      dept_counts AS (
        SELECT department_id, count(*)::int AS c FROM cases
        WHERE department_id IS NOT NULL GROUP BY department_id
      ),
      cat_counts AS (
        SELECT category_id, count(*)::int AS c FROM cases GROUP BY category_id
      )
      SELECT
        (SELECT coalesce(jsonb_object_agg(status, c), '{}'::jsonb) FROM status_counts) AS statuses,
        (SELECT avg_days FROM durations) AS "avgResolutionDays",
        (SELECT coalesce(jsonb_object_agg(department_id, c), '{}'::jsonb) FROM dept_counts) AS "byDepartment",
        (SELECT coalesce(jsonb_object_agg(category_id, c), '{}'::jsonb) FROM cat_counts) AS "byCategory",
        (SELECT count(*)::int FROM cases WHERE created_at >= ${yesterday}::date::timestamp - interval '7 hours'
          AND created_at < (${yesterday}::date + 1)::timestamp - interval '7 hours') AS "dailyArrivals",
        (SELECT count(*)::int FROM cases WHERE closed_at >= ${yesterday}::date::timestamp - interval '7 hours'
          AND closed_at < (${yesterday}::date + 1)::timestamp - interval '7 hours') AS "dailyClosures"
    `);
    const p = prevRows[0];
    if (p) {
      const prevStatus: Partial<Record<CaseStatus, number>> = {};
      for (const [status, value] of Object.entries(p.statuses ?? {})) {
        prevStatus[status as CaseStatus] = numberFrom(value);
      }
      const prevTotal = Object.values(prevStatus).reduce((sum, n) => sum + (n ?? 0), 0);
      await db.update(caseStatsDaily).set({
        totalReceived: numberFrom(p.dailyArrivals),
        totalClosed: numberFrom(p.dailyClosures),
        totalRejected: prevStatus.rejected ?? 0,
        totalInProgress: OPEN_STATUSES.reduce((sum, s) => sum + (prevStatus[s] ?? 0), 0),
        avgResolutionDays: p.avgResolutionDays === null ? null : numberFrom(p.avgResolutionDays),
        byDepartment: toCounts(p.byDepartment),
        byCategory: toCounts(p.byCategory),
        metadata: {
          refreshedAt: new Date().toISOString(),
          totalCases: prevTotal,
          statusCounts: {
            received: prevStatus.received ?? 0,
            closed: prevStatus.closed ?? 0,
            rejected: prevStatus.rejected ?? 0,
            inProgress: OPEN_STATUSES.reduce((sum, s) => sum + (prevStatus[s] ?? 0), 0),
          },
        },
      }).where(eq(caseStatsDaily.id, prev.id));
    }
  }

  return NextResponse.json({
    success: true,
    date: today,
    stats: {
      totalCases,
      totalReceived: countByStatus.received ?? 0,
      totalClosed: closedCount,
      totalRejected: rejectedCount,
      totalInProgress: inProgressCount,
      avgResolutionDays,
      dailyArrivals,
      dailyClosures,
    },
  });
}
