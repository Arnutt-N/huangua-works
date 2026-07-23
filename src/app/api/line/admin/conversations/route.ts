import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations, lineUsers } from '@/lib/db/schema';
import { auth } from '@/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();

  const conversations = await db
    .select({
      id: chatConversations.id,
      mode: chatConversations.mode,
      lastMessageText: chatConversations.lastMessageText,
      lastMessageAt: chatConversations.lastMessageAt,
      lastMessageSender: chatConversations.lastMessageSender,
      unreadAdmin: chatConversations.unreadAdmin,
      assignedAdminId: chatConversations.assignedAdminId,
      linkedCaseId: chatConversations.linkedCaseId,
      displayName: lineUsers.displayName,
      lineUserId: lineUsers.lineUserId,
    })
    .from(chatConversations)
    .leftJoin(lineUsers, eq(chatConversations.lineUserId, lineUsers.lineUserId))
    .orderBy(desc(chatConversations.lastMessageAt));

  return NextResponse.json(conversations);
}
