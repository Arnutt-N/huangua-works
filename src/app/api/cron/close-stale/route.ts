/**
 * GET /api/cron/close-stale — ปิดเรื่องเก่าอัตโนมัติ (เรียกทุก 1 วัน)
 * เรื่องที่ status='done' เกิน 7 วัน → auto close ผ่าน applyCaseUpdate
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases } from '@/lib/db/schema';
import { applyCaseUpdate, SYSTEM_ACTOR } from '@/lib/cases/operations';
import { requireCron } from '@/lib/cron-auth';
import { eq, and, lt } from 'drizzle-orm';

const STALE_DAYS = 7;

export async function GET(req: NextRequest) {
  const auth = requireCron(req);
  if (!auth.ok) return auth.response;

  const db = await getDb();
  const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const staleCases = await db
    .select({ id: cases.id })
    .from(cases)
    // § ข้ามเรื่องนำเข้าย้อนหลัง — updatedAt ของแถว historical คือวันที่รับเรื่องจริง
    // จึงเก่ากว่า threshold เสมอ ถ้าไม่ข้ามจะถูกปิดอัตโนมัติทั้งหมดตั้งแต่ cron รอบแรก
    .where(and(eq(cases.status, 'done'), eq(cases.isHistorical, false), lt(cases.updatedAt, staleThreshold)));

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
