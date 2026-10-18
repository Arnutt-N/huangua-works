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
import { getDueScheduled, sendBroadcast } from '@/lib/line/broadcast-service';
import { requireCron } from '@/lib/cron-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = requireCron(request);
  if (!auth.ok) return auth.response;

  const due = await getDueScheduled();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of due) {
    const outcome = await sendBroadcast(item.id);
    // § นับ sent เฉพาะที่ส่งสำเร็จจริง — เดิมนับทุกแถวที่แตะทำให้ failed ดูเหมือนส่งแล้ว
    if (outcome.kind === 'sent') sent++;
    else if (outcome.kind === 'failed') failed++;
    else skipped++;
  }

  return NextResponse.json({ ok: true, sent, failed, skipped });
}
