import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatReplyObjects, chatIntentResponses, chatFaq } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

const updateSchema = z.object({
  objectType: z.enum(['flex', 'template', 'text', 'image']).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  altText: z.string().max(200).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const db = await getDb();
  const [existing] = await db.select({ id: chatReplyObjects.id }).from(chatReplyObjects).where(eq(chatReplyObjects.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบ reply object' }, { status: 404 });
  }

  await db
    .update(chatReplyObjects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(chatReplyObjects.id, id));

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.REPLY_OBJECT_UPDATE,
    resource: 'chat_reply_objects',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();

  const [existing] = await db.select({ objectId: chatReplyObjects.objectId }).from(chatReplyObjects).where(eq(chatReplyObjects.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบ reply object' }, { status: 404 });
  }

  const usageCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatIntentResponses)
    .where(eq(chatIntentResponses.replyObjectId, id));

  const faqUsage = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatFaq)
    .where(and(eq(chatFaq.isActive, true), sql`${chatFaq.answer} LIKE ${'%' + existing.objectId + '%'}`));

  const totalUsage = (usageCount[0]?.count ?? 0) + (faqUsage[0]?.count ?? 0);
  if (totalUsage > 0) {
    return NextResponse.json(
      { error: `ไม่สามารถลบได้ — ถูกอ้างอยู่ใน ${totalUsage} ที่ (intent responses / FAQ)` },
      { status: 409 },
    );
  }

  await db.update(chatReplyObjects).set({ isActive: false, updatedAt: new Date() }).where(eq(chatReplyObjects.id, id));

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.REPLY_OBJECT_DELETE,
    resource: 'chat_reply_objects',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}
