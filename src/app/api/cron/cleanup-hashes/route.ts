/**
 * GET /api/cron/cleanup-hashes — ลบ dedup hashes ที่หมดอายุ (เรียกทุก 1 วัน)
 * ลบ hashes ที่ expiresAt < now
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredHashes } from '@/lib/dedup';
import { cleanupWebhookEvents } from '@/lib/line/webhook-events';
import { requireCron } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  const auth = requireCron(req);
  if (!auth.ok) return auth.response;

  const deletedCount = await cleanupExpiredHashes();
  // § ใช้ cron เดิม — inbox terminal row หมดอายุแล้วต้องล้างตาม dedup window โดยไม่เพิ่ม job ภายนอก
  const webhookEventsDeleted = await cleanupWebhookEvents();

  return NextResponse.json({
    success: true,
    deletedCount,
    webhookEventsDeleted,
    message: `ลบ dedup hashes ที่หมดอายุ ${deletedCount} รายการ และ inbox เก่า ${webhookEventsDeleted} รายการ`,
  });
}
