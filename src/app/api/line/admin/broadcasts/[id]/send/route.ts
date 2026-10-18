import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatBroadcasts } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { sendBroadcast } from '@/lib/line/broadcast-service';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();

  const [row] = await db.select({ id: chatBroadcasts.id, status: chatBroadcasts.status }).from(chatBroadcasts).where(eq(chatBroadcasts.id, id)).limit(1);
  if (!row) {
    return NextResponse.json({ error: 'ไม่พบ broadcast' }, { status: 404 });
  }
  if (row.status === 'sent' || row.status === 'sending') {
    return NextResponse.json({ error: 'ส่งแล้วหรือกำลังส่ง' }, { status: 409 });
  }

  await db.update(chatBroadcasts).set({ status: 'scheduled', scheduledAt: new Date(), updatedAt: new Date() }).where(eq(chatBroadcasts.id, id));
  const outcome = await sendBroadcast(id);

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.BROADCAST_SEND,
    resource: 'chat_broadcasts',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  // § ส่งไม่สำเร็จต้องตอบตามจริง ห้ามคืน ok ทั้งที่ service mark failed
  if (outcome.kind === 'failed') {
    return NextResponse.json(
      { ok: false, error: outcome.error, totalRecipients: outcome.totalRecipients, successCount: outcome.successCount, failedCount: outcome.failedCount },
      { status: 502 },
    );
  }
  if (outcome.kind === 'skipped-not-claimable') {
    return NextResponse.json({ error: 'ส่งแล้วหรือกำลังส่ง' }, { status: 409 });
  }
  return NextResponse.json({
    ok: true,
    totalRecipients: outcome.totalRecipients,
    successCount: outcome.successCount,
    failedCount: outcome.failedCount,
  });
}
