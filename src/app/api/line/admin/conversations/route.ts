import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations, lineUsers } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';

export const runtime = 'nodejs';

export async function GET() {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

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
