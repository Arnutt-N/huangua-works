/**
 * GET /api/cron/cleanup-hashes — ลบ dedup hashes ที่หมดอายุ (เรียกทุก 1 วัน)
 * ลบ hashes ที่ expiresAt < now
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredHashes } from '@/lib/dedup';
import { requireCron } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  const auth = requireCron(req);
  if (!auth.ok) return auth.response;

  const deletedCount = await cleanupExpiredHashes();

  return NextResponse.json({
    success: true,
    deletedCount,
    message: `ลบ dedup hashes ที่หมดอายุ ${deletedCount} รายการ`,
  });
}
