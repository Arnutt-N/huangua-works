import { NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatMessages, chatConversations } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { updateConversationSchema, validateOrError } from '@/lib/validation';
import { broadcast } from '@/lib/line/sse/broadcaster';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();

  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1);

  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, id))
    .orderBy(asc(chatMessages.createdAt));

  return NextResponse.json({ conversation, messages });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = validateOrError(updateConversationSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { mode, linkedCaseId } = validation.data;
  const { id } = await params;
  const db = await getDb();

  const updates: Partial<typeof chatConversations.$inferInsert> = { updatedAt: new Date() };

  if (mode) {
    updates.mode = mode;
    if (mode === 'human_active') {
      updates.assignedAdminId = authz.ctx.user.id;
      updates.assignedAt = new Date();
    }
    if (mode === 'resolved') {
      updates.resolvedAt = new Date();
    }
  }

  if (linkedCaseId !== undefined) {
    updates.linkedCaseId = linkedCaseId;
  }

  // claim ต้องเป็น atomic — guard mode ใน WHERE กันสองแอดมินกดรับพร้อมกันแล้วคนหลังทับเงียบๆ
  const claimGuard =
    mode === 'human_active'
      ? inArray(chatConversations.mode, ['bot_active', 'waiting_handoff'])
      : undefined;

  const [updated] = await db
    .update(chatConversations)
    .set(updates)
    .where(and(eq(chatConversations.id, id), claimGuard))
    .returning({ id: chatConversations.id });

  if (!updated) {
    const [existing] = await db
      .select({
        mode: chatConversations.mode,
        assignedAdminId: chatConversations.assignedAdminId,
      })
      .from(chatConversations)
      .where(eq(chatConversations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (existing.mode === 'human_active' && existing.assignedAdminId === authz.ctx.user.id) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: 'มีเจ้าหน้าที่รับเรื่องนี้แล้ว' },
      { status: 409 },
    );
  }

  broadcast({ type: 'mode_change', conversationId: id, payload: updates });

  return NextResponse.json({ ok: true });
}
