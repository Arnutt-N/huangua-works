/**
 * GET /api/cron/close-stale — ปิดเรื่องเก่าอัตโนมัติ (เรียกทุก 1 วัน)
 * เรื่องที่ status='done' เกิน 7 วัน → auto close
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, caseUpdates } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
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

  const db = getDb();
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);

  // § Find cases status='done' + updatedAt < 7 วันที่แล้ว
  const staleCases = await db
    .select()
    .from(cases)
    .where(and(eq(cases.status, 'done'), lt(cases.updatedAt, staleThreshold)))
    .all();

  let closedCount = 0;

  for (const c of staleCases) {
    // Update case status → closed
    await db
      .update(cases)
      .set({
        status: 'closed',
        closedAt: now,
        updatedAt: now,
      })
      .where(eq(cases.id, c.id))
      .run();

    // Log update
    await db.insert(caseUpdates).values({
      id: generateId(),
      caseId: c.id,
      userId: 'system',
      updateType: 'status_change',
      oldValue: 'done',
      newValue: 'closed',
      comment: 'ปิดเรื่องอัตโนมัติ (เกิน 7 วัน)',
      isPublic: true,
    });

    closedCount++;
  }

  return NextResponse.json({
    success: true,
    closedCount,
    message: `ปิดเรื่องอัตโนมัติ ${closedCount} รายการ`,
  });
}
