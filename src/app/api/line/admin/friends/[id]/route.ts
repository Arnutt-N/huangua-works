import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { lineFriendEvents, lineUsers, richMenus } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { countFollowStats } from '@/lib/line/friend-events';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getAssignedMenuId } from '../assigned-menu';

export const runtime = 'nodejs';

export type FriendFollowState = 'following' | 'unfollowed';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();

  // § ห้ามเพิ่ม lineUserIdEnc เต็มเส้นหรือ raw id (T5) — maskedId 8 ตัวแรกพอ
  const row = await firstOrUndefined(
    db
      .select({
        id: lineUsers.id,
        displayName: lineUsers.displayName,
        pictureUrl: lineUsers.pictureUrl,
        lastMessageAt: lineUsers.lastMessageAt,
        metadata: lineUsers.metadata,
        maskedId: sql<string | null>`left(${lineUsers.lineUserIdEnc}, 8)`,
      })
      .from(lineUsers)
      .where(eq(lineUsers.id, id))
      .limit(1),
  );
  if (!row) {
    return NextResponse.json({ error: 'ไม่พบเพื่อนคนนี้' }, { status: 404 });
  }

  const events = await db
    .select({
      event: lineFriendEvents.event,
      createdAt: lineFriendEvents.createdAt,
    })
    .from(lineFriendEvents)
    .where(eq(lineFriendEvents.lineUserId, id))
    .orderBy(lineFriendEvents.createdAt);

  const stats = countFollowStats(events);
  const latestEvent = events.length > 0 ? events[events.length - 1]?.event ?? null : null;
  const followState: FriendFollowState = latestEvent === 'unfollow' ? 'unfollowed' : 'following';

  const richMenuId = getAssignedMenuId(row.metadata);
  let richMenuName: string | null = null;
  if (richMenuId) {
    const menu = await firstOrUndefined(
      db.select({ name: richMenus.name }).from(richMenus).where(eq(richMenus.id, richMenuId)).limit(1),
    );
    richMenuName = menu?.name ?? null;
  }

  return NextResponse.json({
    id: row.id,
    maskedId: row.maskedId,
    displayName: row.displayName,
    pictureUrl: row.pictureUrl,
    followState,
    followCount: stats.followCount,
    refollowCount: stats.refollowCount,
    lastFollowAt: stats.lastFollowAt ? stats.lastFollowAt.toISOString() : null,
    lastActiveAt: row.lastMessageAt,
    richMenuId,
    richMenuName,
  });
}
