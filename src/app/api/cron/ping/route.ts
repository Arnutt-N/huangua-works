/**
 * GET /api/cron/ping — health check (เรียกทุก 5 นาที)
 * ตรวจสอบว่า cron jobs ยังทำงานอยู่
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.length < 16) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  // Verify cron secret
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: 'Cron ping OK',
  });
}
