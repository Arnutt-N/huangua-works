/**
 * GET /api/cron/stats-refresh — refresh case_stats_daily (เรียกทุก 00:00)
 * คำนวณสถิติรายวันแล้วเก็บเข้า case_stats_daily table
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, caseStatsDaily } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { sql, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.length < 16) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const today: string = new Date().toISOString().split('T')[0]!; // YYYY-MM-DD

  // § Count cases by status (1 GROUP BY query แทน 4 query แยกตาม status)
  const statusCounts = await db
    .select({ status: cases.status, count: sql<number>`count(*)` })
    .from(cases)
    .groupBy(cases.status);

  const countByStatus = new Map<string, number>();
  for (const row of statusCounts) {
    // count(*) จาก postgres-js คืนเป็น string (bigint) โดย default — ต้อง Number() ก่อนบวกรวม
    countByStatus.set(row.status, Number(row.count));
  }

  const receivedCount = countByStatus.get('received') ?? 0;
  const closedCount = countByStatus.get('closed') ?? 0;
  const rejectedCount = countByStatus.get('rejected') ?? 0;
  const inProgressCount =
    (countByStatus.get('in_progress') ?? 0) +
    (countByStatus.get('assigned') ?? 0) +
    (countByStatus.get('reviewing') ?? 0);

  // § Calculate average resolution days (closed cases only)
  const closedCases = await db
    .select()
    .from(cases)
    .where(eq(cases.status, 'closed'));

  let avgResolutionDays: number | null = null;
  if (closedCases.length > 0) {
    const totalDays = closedCases.reduce((sum, c) => {
      if (!c.closedAt) return sum;
      const resolutionDays = Math.floor(
        (new Date(c.closedAt).getTime() - new Date(c.createdAt).getTime()) / 86400000,
      );
      return sum + resolutionDays;
    }, 0);
    avgResolutionDays = Math.round(totalDays / closedCases.length);
  }

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
