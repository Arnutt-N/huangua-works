import { NextResponse } from 'next/server';
import { count, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { chatBroadcastFailedRecipients, chatBroadcasts } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();

  const row = await firstOrUndefined(
    db
      .select({
        id: chatBroadcasts.id,
        content: chatBroadcasts.content,
        status: chatBroadcasts.status,
        target: chatBroadcasts.target,
        scheduledAt: chatBroadcasts.scheduledAt,
        sentAt: chatBroadcasts.sentAt,
        totalRecipients: chatBroadcasts.totalRecipients,
        successCount: chatBroadcasts.successCount,
        failedCount: chatBroadcasts.failedCount,
        createdAt: chatBroadcasts.createdAt,
      })
      .from(chatBroadcasts)
      .where(eq(chatBroadcasts.id, id))
      .limit(1),
  );
  if (!row) {
    return NextResponse.json({ error: 'ไม่พบ broadcast' }, { status: 404 });
  }

  const [failed] = await db
    .select({ failedRecipients: count() })
    .from(chatBroadcastFailedRecipients)
    .where(eq(chatBroadcastFailedRecipients.broadcastId, id));

  // § อ่านราย broadcast เป็น sensitive read (เห็น target + สถิติ) — audit ทุกครั้งเหมือน VIEW_CASE
  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.BROADCAST_VIEW,
    resource: 'chat_broadcasts',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ...row, failedRecipients: failed?.failedRecipients ?? 0 });
}
