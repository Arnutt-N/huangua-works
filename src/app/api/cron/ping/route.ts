/**
 * GET /api/cron/ping — health check (เรียกทุก 5 นาที)
 * ตรวจสอบว่า cron jobs ยังทำงานอยู่
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCron } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  const auth = requireCron(req);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: 'Cron ping OK',
  });
}
