/**
 * GET /api/cron/cleanup-hashes — ลบ dedup hashes ที่หมดอายุ (เรียกทุก 1 วัน)
 * ลบ hashes ที่ expiresAt < now
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredHashes } from '@/lib/dedup';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.length < 16) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deletedCount = await cleanupExpiredHashes();

  return NextResponse.json({
    success: true,
    deletedCount,
    message: `ลบ dedup hashes ที่หมดอายุ ${deletedCount} รายการ`,
  });
}
