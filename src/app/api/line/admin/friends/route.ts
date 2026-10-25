import { NextResponse } from 'next/server';
import { and, count, eq, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { lineFriendEvents, lineUsers, richMenus, chatConversations } from '@/lib/db/schema';
import { escapeLike } from '@/lib/db/like';
import { countFollowStats } from '@/lib/line/friend-events';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getAssignedMenuId } from './assigned-menu';

export const runtime = 'nodejs';

const querySchema = z.object({
  q: z.string().trim().max(100, 'คำค้นหายาวเกินไป').optional().default(''),
  status: z.enum(['all', 'following', 'unfollowed']).optional().default('all'),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type FriendFollowState = 'following' | 'unfollowed';

export async function GET(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'พารามิเตอร์ไม่ถูกต้อง' },
      { status: 400 },
    );
  }
  const { q, status, page, pageSize } = parsed.data;

  const db = await getDb();

  // event ล่าสุดต่อคน — scalar subquery ใช้ซ้ำใน SELECT + WHERE (filter ใน SQL ไม่โหลดทั้งตาราง)
  // § ห้ามเขียน ${lineUsers.id} ใน subquery นี้ — drizzle render column ใน sql fragment แบบไม่ qualify
  // ("id" ลอยๆ จะ bind กับ line_friend_events.id ของ scope ใน ทำให้ subquery ว่างตลอด — พิสูจน์ด้วย toSQL)
  // outer query ไม่ตั้ง alias จึงอ้าง "line_users"."id" ตรงๆ ได้เสมอ
  // ไม่มี event = เคย follow มาก่อน (แถว lineUsers เกิดจาก follow/message) จึงนับเป็น following
  const latestEvent = sql<string | null>`(SELECT ${lineFriendEvents.event} FROM ${lineFriendEvents} WHERE ${lineFriendEvents.lineUserId} = ${sql.raw('"line_users"."id"')} ORDER BY ${lineFriendEvents.createdAt} DESC LIMIT 1)`;

  const conditions: SQL[] = [];
  if (q) conditions.push(ilike(lineUsers.displayName, `%${escapeLike(q)}%`));
  if (status === 'following') {
    conditions.push(sql`(${latestEvent} IS NULL OR ${latestEvent} = 'follow')`);
  } else if (status === 'unfollowed') {
    conditions.push(sql`${latestEvent} = 'unfollow'`);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db.select({ value: count() }).from(lineUsers).where(where);
  const total = countRow?.value ?? 0;

  // § select นี้ห้ามเพิ่ม lineUserIdEnc เต็มเส้นหรือ raw id เด็ดขาด (T5) —
  // maskedId 8 ตัวแรกพอระบุตัวใน UI ตรง convention เดียวกับ conversations/search route
  const rows = await db
    .select({
      id: lineUsers.id,
      displayName: lineUsers.displayName,
      pictureUrl: lineUsers.pictureUrl,
      lastMessageAt: lineUsers.lastMessageAt,
      metadata: lineUsers.metadata,
      maskedId: sql<string | null>`left(${lineUsers.lineUserIdEnc}, 8)`,
      latestEvent,
      // § ห้องเดียวต่อคน (uniqueIndex chat_conversations_line_user_id_hash_idx) — leftJoin ตรงได้ไม่ทำแถวซ้ำ
      chatMode: chatConversations.mode,
    })
    .from(lineUsers)
    .leftJoin(chatConversations, eq(chatConversations.lineUserIdHash, lineUsers.lineUserIdHash))
    .where(where)
    .orderBy(sql`${lineUsers.lastMessageAt} DESC NULLS LAST`, lineUsers.id)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // สถิติ follow นับจาก events ของแถวในหน้านี้เท่านั้น (สูงสุด pageSize แถว ไม่ใช่ทั้งตาราง)
  const pageIds = rows.map((r) => r.id);
  const eventsByUser = new Map<string, { event: string; createdAt: Date }[]>();
  if (pageIds.length > 0) {
    const events = await db
      .select({
        friendId: lineFriendEvents.lineUserId,
        event: lineFriendEvents.event,
        createdAt: lineFriendEvents.createdAt,
      })
      .from(lineFriendEvents)
      .where(inArray(lineFriendEvents.lineUserId, pageIds))
      .orderBy(lineFriendEvents.createdAt);
    for (const e of events) {
      const list = eventsByUser.get(e.friendId) ?? [];
      list.push({ event: e.event, createdAt: e.createdAt });
      eventsByUser.set(e.friendId, list);
    }
  }

  const items = rows.map((r) => {
    const stats = countFollowStats(eventsByUser.get(r.id) ?? []);
    const followState: FriendFollowState = r.latestEvent === 'unfollow' ? 'unfollowed' : 'following';
    return {
      id: r.id,
      maskedId: r.maskedId,
      displayName: r.displayName,
      pictureUrl: r.pictureUrl,
      followState,
      followCount: stats.followCount,
      refollowCount: stats.refollowCount,
      lastFollowAt: stats.lastFollowAt ? stats.lastFollowAt.toISOString() : null,
      chatMode: r.chatMode ?? null,
      lastActiveAt: r.lastMessageAt,
      richMenuId: getAssignedMenuId(r.metadata),
    };
  });

  const menuIds = [...new Set(items.map((r) => r.richMenuId).filter((v): v is string => v !== null))];
  const menuNames = new Map<string, string>();
  if (menuIds.length > 0) {
    const menus = await db
      .select({ id: richMenus.id, name: richMenus.name })
      .from(richMenus)
      .where(inArray(richMenus.id, menuIds));
    for (const m of menus) menuNames.set(m.id, m.name);
  }

  return NextResponse.json({
    items: items.map((r) => ({
      ...r,
      richMenuName: r.richMenuId ? (menuNames.get(r.richMenuId) ?? null) : null,
    })),
    total,
    page,
    pageSize,
  });
}
