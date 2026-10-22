import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
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

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(500),
});

export async function GET(request: Request) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'พารามิเตอร์ไม่ถูกต้อง' },
      { status: 400 },
    );
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
      assignedAdminName: users.fullName,
      linkedCaseId: chatConversations.linkedCaseId,
      displayName: lineUsers.displayName,
      pictureUrl: lineUsers.pictureUrl,
      // masked 8 ตัวแรกพอระบุตัวใน UI ไม่เผยทั้งเส้น
      lineUserId: sql<string | null>`left(${lineUsers.lineUserIdEnc}, 8)`,
      pinned: chatAdminPrefs.pinned,
      muted: chatAdminPrefs.muted,
    })
    .from(chatConversations)
    .leftJoin(lineUsers, eq(chatConversations.lineUserIdHash, lineUsers.lineUserIdHash))
    .leftJoin(users, eq(chatConversations.assignedAdminId, users.id))
    .leftJoin(
      chatAdminPrefs,
      and(
        eq(chatAdminPrefs.conversationId, chatConversations.id),
        eq(chatAdminPrefs.adminUserId, authz.ctx.user.id),
      ),
    )
    .orderBy(desc(chatConversations.lastMessageAt))
    .limit(parsed.data.limit);

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
