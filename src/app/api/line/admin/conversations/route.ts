import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  chatAdminPrefs,
  chatConversations,
  chatConversationTags,
  chatTags,
  lineUsers,
  users,
} from '@/lib/db/schema';
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
      assignedAdminName: users.fullName,
      linkedCaseId: chatConversations.linkedCaseId,
      displayName: lineUsers.displayName,
      pictureUrl: lineUsers.pictureUrl,
      lineUserId: chatConversations.lineUserId,
      pinned: chatAdminPrefs.pinned,
      muted: chatAdminPrefs.muted,
    })
    .from(chatConversations)
    .leftJoin(lineUsers, eq(chatConversations.lineUserId, lineUsers.lineUserId))
    .leftJoin(users, eq(chatConversations.assignedAdminId, users.id))
    .leftJoin(
      chatAdminPrefs,
      and(
        eq(chatAdminPrefs.conversationId, chatConversations.id),
        eq(chatAdminPrefs.adminUserId, authz.ctx.user.id),
      ),
    )
    .orderBy(desc(chatConversations.lastMessageAt));

  // tags: query แยกแล้วประกอบใน JS — เลี่ยง json_agg ผ่าน drizzle
  const conversationIds = conversations.map((c) => c.id);
  const tagsByConversation: Record<string, { id: string; name: string; color: string }[]> = {};
  if (conversationIds.length > 0) {
    const tagRows = await db
      .select({
        conversationId: chatConversationTags.conversationId,
        id: chatTags.id,
        name: chatTags.name,
        color: chatTags.color,
      })
      .from(chatConversationTags)
      .innerJoin(chatTags, eq(chatConversationTags.tagId, chatTags.id))
      .where(inArray(chatConversationTags.conversationId, conversationIds));

    for (const row of tagRows) {
      (tagsByConversation[row.conversationId] ??= []).push({
        id: row.id,
        name: row.name,
        color: row.color,
      });
    }
  }

  return NextResponse.json(
    conversations.map((c) => ({
      ...c,
      pinned: c.pinned ?? false,
      muted: c.muted ?? false,
      tags: tagsByConversation[c.id] ?? [],
    })),
  );
}
