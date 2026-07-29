/**
 * GET /api/cron/close-stale — ปิดเรื่องเก่าอัตโนมัติ (เรียกทุก 1 วัน)
 * เรื่องที่ status='done' เกิน 7 วัน → auto close ผ่าน applyCaseUpdate
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases } from '@/lib/db/schema';
import { applyCaseUpdate, SYSTEM_ACTOR } from '@/lib/cases/operations';
import { eq, and, lt } from 'drizzle-orm';

const STALE_DAYS = 7;

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
  const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const staleCases = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.status, 'done'), lt(cases.updatedAt, staleThreshold)));

  let closedCount = 0;
  const failures: string[] = [];

  for (const c of staleCases) {
    const result = await applyCaseUpdate(
      c.id,
      {
        kind: 'status',
        newStatus: 'closed',
        comment: `ปิดเรื่องอัตโนมัติ (เกิน ${STALE_DAYS} วัน)`,
        isPublic: true,
      },
      SYSTEM_ACTOR,
    );

    if (result.ok) {
      closedCount++;
    } else {
      console.error(`[cron/close-stale] case ${c.id}: ${result.error}`);
      failures.push(c.id);
    }
  }

  return NextResponse.json({
    success: failures.length === 0,
    closedCount,
    failedCount: failures.length,
    message: `ปิดเรื่องอัตโนมัติ ${closedCount} รายการ`,
  });
}
