/**
 * GET /api/cron/stats-refresh — refresh case_stats_daily (เรียกทุก 00:00)
 * คำนวณสถิติรายวันแล้วเก็บเข้า case_stats_daily table
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, caseStatsDaily } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { sql, eq, or } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.length < 16) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const today: string = new Date().toISOString().split('T')[0]!; // YYYY-MM-DD

  // § Count cases by status
  const receivedCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(cases)
    .where(eq(cases.status, 'received'))
    .get();

  const closedCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(cases)
    .where(eq(cases.status, 'closed'))
    .get();

  const rejectedCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(cases)
    .where(eq(cases.status, 'rejected'))
    .get();

  const inProgressCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(cases)
    .where(or(eq(cases.status, 'in_progress'), eq(cases.status, 'assigned'), eq(cases.status, 'reviewing')))
    .get();

  // § Calculate average resolution days (closed cases only)
  const closedCases = await db
    .select()
    .from(cases)
    .where(eq(cases.status, 'closed'))
    .all();

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
  const allCases = await db.select().from(cases).all();
  const byDepartment: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const c of allCases) {
    if (c.departmentId) {
      byDepartment[c.departmentId] = (byDepartment[c.departmentId] || 0) + 1;
    }
    byCategory[c.categoryId] = (byCategory[c.categoryId] || 0) + 1;
  }

  // § Upsert stats
  const existingRows = await db
    .select()
    .from(caseStatsDaily)
    .where(eq(caseStatsDaily.date, today))
    .all();
  const existing = existingRows[0];

  if (existing) {
    await db
      .update(caseStatsDaily)
      .set({
        totalReceived: receivedCount?.count || 0,
        totalClosed: closedCount?.count || 0,
        totalRejected: rejectedCount?.count || 0,
        totalInProgress: inProgressCount?.count || 0,
        avgResolutionDays,
        byDepartment: JSON.stringify(byDepartment),
        byCategory: JSON.stringify(byCategory),
        metadata: JSON.stringify({ refreshedAt: new Date().toISOString() }),
      })
      .where(eq(caseStatsDaily.date, today))
      .run();
  } else {
    await db.insert(caseStatsDaily).values({
      id: generateId(),
      date: today,
      totalReceived: receivedCount?.count || 0,
      totalClosed: closedCount?.count || 0,
      totalRejected: rejectedCount?.count || 0,
      totalInProgress: inProgressCount?.count || 0,
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
      totalReceived: receivedCount?.count || 0,
      totalClosed: closedCount?.count || 0,
      totalRejected: rejectedCount?.count || 0,
      totalInProgress: inProgressCount?.count || 0,
      avgResolutionDays,
    },
  });
}
