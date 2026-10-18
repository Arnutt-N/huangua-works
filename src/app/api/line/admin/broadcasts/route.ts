import { NextResponse } from 'next/server';
import { desc, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatBroadcasts, chatBroadcastFailedRecipients } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { broadcastTargetSchema } from '@/lib/line/broadcast-target';
import { z } from 'zod';

export const runtime = 'nodejs';

const createSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()).min(1).max(5),
  target: broadcastTargetSchema.default({ kind: 'all' }),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const db = await getDb();
  const rows = await db
    .select()
    .from(chatBroadcasts)
    .orderBy(desc(chatBroadcasts.createdAt))
    .limit(50);

  // § จำนวนผู้รับที่ล้มต่อ broadcast สำหรับสรุปในรายการ — hash อย่างเดียว ไม่คืนรายละเอียดผู้รับ
  const failedRows = await db
    .select({ broadcastId: chatBroadcastFailedRecipients.broadcastId, failedRecipients: sql<number>`count(*)::int` })
    .from(chatBroadcastFailedRecipients)
    .groupBy(chatBroadcastFailedRecipients.broadcastId);
  const failedById = new Map(failedRows.map((r) => [r.broadcastId, r.failedRecipients]));

  return NextResponse.json({
    items: rows.map((row) => ({ ...row, failedRecipients: failedById.get(row.id) ?? 0 })),
  });
}

export async function POST(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(createSchema, request);
  if (!result.ok) return result.response;

  const db = await getDb();
  const id = generateId();
  const status = result.data.scheduledAt ? 'scheduled' : 'draft';

  await db.insert(chatBroadcasts).values({
    id,
    content: result.data.content,
    status,
    target: result.data.target,
    scheduledAt: result.data.scheduledAt ? new Date(result.data.scheduledAt) : null,
    createdBy: authz.ctx.user.id,
  });

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.BROADCAST_CREATE,
    resource: 'chat_broadcasts',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
