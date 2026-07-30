import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
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

  const [updated] = await db
    .update(chatConversations)
    .set(updates)
    .where(eq(chatConversations.id, id))
    .returning({ id: chatConversations.id });

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  broadcast({ type: 'mode_change', conversationId: id, payload: updates });

  return NextResponse.json({ ok: true });
}
