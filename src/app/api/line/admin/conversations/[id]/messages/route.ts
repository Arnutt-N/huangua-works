import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatMessages, chatConversations } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { auth } from '@/auth';
import { pushMessage } from '@/lib/line/client';
import { broadcast } from '@/lib/line/sse/broadcaster';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const text = (body.text as string)?.trim();

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

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
    adminUserId: session.user.id,
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
