import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatMessages, chatConversations } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { chatReplySchema, validateOrError } from '@/lib/validation';
import { pushMessage } from '@/lib/line/client';
import { broadcast } from '@/lib/line/sse/broadcaster';

export const runtime = 'nodejs';

export async function POST(
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

  const validation = validateOrError(chatReplySchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { text } = validation.data;
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

  const messageId = generateId();
  await db.insert(chatMessages).values({
    id: messageId,
    conversationId: id,
    sender: 'admin',
    messageType: 'text',
    textContent: text,
    adminUserId: authz.ctx.user.id,
  });

  await db
    .update(chatConversations)
    .set({
      lastMessageText: text,
      lastMessageAt: new Date(),
      lastMessageSender: 'admin',
      unreadAdmin: 0,
      updatedAt: new Date(),
    })
    .where(eq(chatConversations.id, id));

  await pushMessage(conversation.lineUserId, [{ type: 'text', text }]);

  broadcast({
    type: 'new_message',
    conversationId: id,
    payload: {
      id: messageId,
      sender: 'admin',
      messageType: 'text',
      textContent: text,
      createdAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ ok: true, messageId });
}
