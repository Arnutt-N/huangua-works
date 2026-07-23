import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatMessages, chatConversations } from '@/lib/db/schema';
import { auth } from '@/auth';
import { broadcast } from '@/lib/line/sse/broadcaster';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const db = await getDb();

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.mode) {
    updates.mode = body.mode;
    if (body.mode === 'human_active') {
      updates.assignedAdminId = session.user.id;
      updates.assignedAt = new Date();
    }
    if (body.mode === 'resolved') {
      updates.resolvedAt = new Date();
    }
  }

  if (body.linkedCaseId !== undefined) {
    updates.linkedCaseId = body.linkedCaseId;
  }

  await db
    .update(chatConversations)
    .set(updates)
    .where(eq(chatConversations.id, id));

  broadcast({ type: 'mode_change', conversationId: id, payload: updates });

  return NextResponse.json({ ok: true });
}
