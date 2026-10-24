import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatReplyObjects, chatIntentResponses, chatFaq } from '@/lib/db/schema';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { replyObjectTypeSchema, validateReplyPayload } from '@/lib/line/reply-object-validation';

export const runtime = 'nodejs';

const updateSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อ').max(120).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  objectType: replyObjectTypeSchema.optional(),
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

  const result = await parseBody(updateSchema, request);
  if (!result.ok) return result.response;

  const db = await getDb();
  const [existing] = await db.select({ id: chatReplyObjects.id }).from(chatReplyObjects).where(eq(chatReplyObjects.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบ reply object' }, { status: 404 });
  }

  // § PATCH ส่งมาเป็น delta — ต้องอ่านแถวเดิมมา merge ก่อนตรวจ ไม่เช่นนั้นเปลี่ยน type
  // อย่างเดียวจะทิ้ง payload เก่าไว้แล้วกลายเป็นแถวที่ส่งไม่ได้เงียบๆ
  if (result.data.objectType !== undefined || result.data.payload !== undefined) {
    const [current] = await db
      .select({ objectType: chatReplyObjects.objectType, payload: chatReplyObjects.payload })
      .from(chatReplyObjects)
      .where(eq(chatReplyObjects.id, id))
      .limit(1);
    const mergedType = result.data.objectType ?? current?.objectType;
    const mergedPayload = (result.data.payload ?? current?.payload) as Record<string, unknown>;
    const mergedError = mergedType ? validateReplyPayload(mergedType, mergedPayload) : 'ประเภทไม่ถูกต้อง';
    if (mergedError) return NextResponse.json({ error: mergedError }, { status: 400 });
  }

  await db
    .update(chatReplyObjects)
    .set({ ...result.data, updatedAt: new Date() })
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

  const [existing] = await db
    .select({ objectId: chatReplyObjects.objectId })
    .from(chatReplyObjects)
    .where(and(eq(chatReplyObjects.id, id), eq(chatReplyObjects.isActive, true)))
    .limit(1);
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

  await db
    .update(chatReplyObjects)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(chatReplyObjects.id, id), eq(chatReplyObjects.isActive, true)));

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
