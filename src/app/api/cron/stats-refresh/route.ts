/**
 * GET /api/cron/stats-refresh — refresh case_stats_daily (เรียกทุก 00:00)
 * คำนวณสถิติรายวันแล้วเก็บเข้า case_stats_daily table
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, caseStatsDaily } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { sql, and, eq, isNotNull } from 'drizzle-orm';
import { requireCron } from '@/lib/cron-auth';
import { deriveStatusStats } from '@/lib/cases/stats';
import type { CaseStatus } from '@/lib/cases/state-machine';

export async function GET(req: NextRequest) {
  const auth = requireCron(req);
  if (!auth.ok) return auth.response;

  const db = await getDb();
  const today: string = new Date().toISOString().split('T')[0]!; // YYYY-MM-DD

  // § Count cases by status (1 GROUP BY query แทน 4 query แยกตาม status)
  const statusCounts = await db
    .select({ status: cases.status, count: sql<number>`count(*)` })
    .from(cases)
    .groupBy(cases.status);

  const countByStatus: Partial<Record<CaseStatus, number>> = {};
  for (const row of statusCounts) {
    // count(*) จาก postgres-js คืนเป็น string (bigint) โดย default — ต้อง Number() ก่อนบวกรวม
    countByStatus[row.status] = Number(row.count);
  }

  // § เฉลี่ยวันปิดหารเฉพาะแถวที่มี closedAt จริง — เรื่อง closed ที่ไม่มีวันปิด
  // (ข้อมูลนำเข้าเก่า) ต้องไม่ไปลดค่าเฉลี่ย
  const closedCases = await db
    .select({ createdAt: cases.createdAt, closedAt: cases.closedAt })
    .from(cases)
    .where(and(eq(cases.status, 'closed'), isNotNull(cases.closedAt)));
  const closedDurationsDays = closedCases.map((c) =>
    Math.floor((new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()) / 86400000),
  );

  const stats = deriveStatusStats(countByStatus, closedDurationsDays);
  const receivedCount = stats.totalReceived;
  const closedCount = stats.totalClosed;
  const rejectedCount = stats.totalRejected;
  const inProgressCount = stats.totalInProgress;
  const avgResolutionDays = stats.avgResolutionDays;

  // § Group by department (คำนวณแบบง่าย — ใช้ in-memory)
  const allCases = await db.select().from(cases);
  const byDepartment: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const c of allCases) {
    if (c.departmentId) {
      byDepartment[c.departmentId] = (byDepartment[c.departmentId] || 0) + 1;
    }
    byCategory[c.categoryId] = (byCategory[c.categoryId] || 0) + 1;
  }

  // § Upsert stats
  const existing = await firstOrUndefined(
    db.select().from(caseStatsDaily).where(eq(caseStatsDaily.date, today))
  );

  if (existing) {
    await db
      .update(caseStatsDaily)
      .set({
        totalReceived: receivedCount,
        totalClosed: closedCount,
        totalRejected: rejectedCount,
        totalInProgress: inProgressCount,
        avgResolutionDays,
        byDepartment: JSON.stringify(byDepartment),
        byCategory: JSON.stringify(byCategory),
        metadata: JSON.stringify({ refreshedAt: new Date().toISOString() }),
      })
      .where(eq(caseStatsDaily.date, today));
  } else {
    await db.insert(caseStatsDaily).values({
      id: generateId(),
      date: today,
      totalReceived: receivedCount,
      totalClosed: closedCount,
      totalRejected: rejectedCount,
      totalInProgress: inProgressCount,
      avgResolutionDays,
      byDepartment: JSON.stringify(byDepartment),
      byCategory: JSON.stringify(byCategory),
      metadata: JSON.stringify({ refreshedAt: new Date().toISOString() }),
    });
  }

  return NextResponse.json({
    success: true,
    date: today,
    stats: {
      totalReceived: receivedCount,
      totalClosed: closedCount,
      totalRejected: rejectedCount,
      totalInProgress: inProgressCount,
      avgResolutionDays,
    },
  });
}
