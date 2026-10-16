/**
 * GET /api/cron/close-stale — ปิดเรื่องเก่าอัตโนมัติ (เรียกทุก 1 วัน)
 * เรื่องที่ status='done' เกิน 7 วัน → auto close ผ่าน applyCaseUpdate
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases } from '@/lib/db/schema';
import { applyCaseUpdate, SYSTEM_ACTOR } from '@/lib/cases/operations';
import { requireCron } from '@/lib/cron-auth';
import { eq, and, lt, asc } from 'drizzle-orm';

const STALE_DAYS = 7;
// § จำกัดรอบละ 100 — backlog ใหญ่ select ทั้งหมดแล้ววนทีละเคส lambda timeout ปิดครึ่งค้าง
const CLOSE_STALE_BATCH_LIMIT = 100;

export async function GET(req: NextRequest) {
  const auth = requireCron(req);
  if (!auth.ok) return auth.response;

  const db = await getDb();
  const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  // § เก่าสุดก่อน (เลือกแถวแน่นอน) + ดึงเกิน 1 แถวเพื่อรู้ว่ายังค้างจริง — `>= LIMIT` บอกค้างหลอกตอนเหลือพอดี
  const staleRows = await db
    .select({ id: cases.id })
    .from(cases)
    // § ข้ามเรื่องนำเข้าย้อนหลัง — updatedAt ของแถว historical คือวันที่รับเรื่องจริง
    // จึงเก่ากว่า threshold เสมอ ถ้าไม่ข้ามจะถูกปิดอัตโนมัติทั้งหมดตั้งแต่ cron รอบแรก
    .where(and(eq(cases.status, 'done'), eq(cases.isHistorical, false), lt(cases.updatedAt, staleThreshold)))
    .orderBy(asc(cases.updatedAt))
    .limit(CLOSE_STALE_BATCH_LIMIT + 1);
  const truncated = staleRows.length > CLOSE_STALE_BATCH_LIMIT;
  const staleCases = staleRows.slice(0, CLOSE_STALE_BATCH_LIMIT);

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

  // § cron-job.org ไม่อ่าน body — log ให้เห็น backlog ใน runtime log
  if (truncated) console.warn(`[cron/close-stale] ยังค้างเกิน ${CLOSE_STALE_BATCH_LIMIT} เรื่อง — รอบถัดไปปิดต่อ`);

  return NextResponse.json({
    success: failures.length === 0,
    closedCount,
    failedCount: failures.length,
    truncated,
    message: `ปิดเรื่องอัตโนมัติ ${closedCount} รายการ`,
  });
}
