/**
 * GET /api/cron/ping — health check (เรียกทุก 5 นาที)
 * ตรวจสอบว่า cron jobs ยังทำงานอยู่
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCron } from '@/lib/cron-auth';
import { processWebhookEvents } from '@/lib/line/bot/engine';

const RECOVERY_BATCH_SIZE = 20;

export async function GET(req: NextRequest) {
  const auth = requireCron(req);
  if (!auth.ok) return auth.response;

  // § recovery ของ pending/retry LINE events — อยู่ใน ping เพราะไม่สร้าง cron route ใหม่
  const recovery = await processWebhookEvents(RECOVERY_BATCH_SIZE);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: 'Cron ping OK',
    recovery,
  });
}
