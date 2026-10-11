import { NextResponse } from 'next/server';
import { lt } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';
import { requireCron } from '@/lib/cron-auth';
import { getSystemSetting } from '@/lib/system/settings';

export const runtime = 'nodejs';

/**
 * GET /api/cron/cleanup-audit-logs — ลบ audit log เกินอายุที่ตั้งไว้
 * อ่านอายุจาก system key audit_retention_days (เริ่ม 365 วัน)
 * ตอบแค่จำนวนแถว ไม่เคยตอบเนื้อหา log
 */
export async function GET(req: Request) {
  const auth = requireCron(req);
  if (!auth.ok) return auth.response;

  const retentionDays = await getSystemSetting('audit_retention_days');
  const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const db = await getDb();
  const deleted = await db.delete(auditLogs).where(lt(auditLogs.createdAt, threshold)).returning({ id: auditLogs.id });

  return NextResponse.json({ deleted: deleted.length });
}
