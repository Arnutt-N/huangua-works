/**
 * GET /api/cron/broadcast-send — ส่ง broadcast ที่ถึงกำหนด (เรียกทุก 30 นาที)
 *
 * § รอบ 30 นาทีต้องตรงกับ SEND_WINDOW_MINUTES ใน broadcast-client.tsx ที่บอกผู้ใช้
 * ว่าประกาศอาจออกช้ากว่าเวลาที่ตั้งได้แค่ไหน — แก้ที่ไหนต้องแก้อีกที่ด้วย
 *
 * § ตัวเรียกคือ cron-job.org ไม่ใช่ Vercel Cron — Hobby plan รันได้แค่วันละครั้ง
 * ซึ่งไม่พอกับ broadcast ตั้งเวลา (ดู docs/implementation-plan.md §Vercel config)
 * ถ้าย้ายขึ้น Pro แล้วค่อยเพิ่ม crons กลับเข้า vercel.json ได้
 */

import { NextResponse } from 'next/server';
import { getDueScheduled, recoverStaleSending, sendBroadcast } from '@/lib/line/broadcast-service';
import { requireCron } from '@/lib/cron-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = requireCron(request);
  if (!auth.ok) return auth.response;

  // § requeue งาน sending ค้างก่อนหางานเสมอ — ไม่ต้องรอมี scheduled ใหม่ค่อยตรวจ
  const recovered = await recoverStaleSending();
  const due = await getDueScheduled();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const results: Record<string, unknown>[] = [];

  for (const item of due) {
    // § หนึ่ง try/catch ต่อรายการ — รายการแรกพังต้องไม่หยุดรายการที่เหลือ
    try {
      const outcome = await sendBroadcast(item.id);
      results.push({ id: item.id, ...outcome });
      if (outcome.kind === 'sent') sent++;
      else if (outcome.kind === 'failed') failed++;
      else skipped++;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ id: item.id, kind: 'error', error });
      failed++;
    }
  }

  return NextResponse.json({ ok: true, recovered, sent, failed, skipped, results });
}
