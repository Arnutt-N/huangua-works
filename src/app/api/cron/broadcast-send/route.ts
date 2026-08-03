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

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  // กัน `Bearer undefined` ผ่านตอน env หาย — endpoint นี้เปิดรับ caller ภายนอก
  if (!cronSecret || cronSecret.length < 16) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const due = await getDueScheduled();
  let sent = 0;

  for (const item of due) {
    await sendBroadcast(item.id);
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
