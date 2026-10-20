import { NextResponse } from 'next/server';
import { desc, ilike, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { lineFriendEvents, lineUsers, richMenus } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';

export const runtime = 'nodejs';

const querySchema = z.object({
  q: z.string().trim().max(100, 'คำค้นหายาวเกินไป').optional().default(''),
  status: z.enum(['all', 'following', 'unfollowed']).optional().default('all'),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type FriendFollowState = 'following' | 'unfollowed';

/** escape LIKE metacharacters — กัน q ที่มี % / _ / \ ทำ pattern เพี้ยน (pattern เดียวกับ search route) */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

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

  // § คอลัมน์ที่ select ออก API นี้ — ห้ามเพิ่ม lineUserIdEnc เต็มเส้นหรือ raw id เด็ดขาด (T5)
  // maskedId 8 ตัวแรกพอระบุตัวใน UI ตรง convention เดียวกับ conversations/search route
  const baseQuery = db
    .select({
      id: lineUsers.id,
      displayName: lineUsers.displayName,
      pictureUrl: lineUsers.pictureUrl,
      lastMessageAt: lineUsers.lastMessageAt,
      createdAt: lineUsers.createdAt,
      metadata: lineUsers.metadata,
      maskedId: sql<string | null>`left(${lineUsers.lineUserIdEnc}, 8)`,
    })
    .from(lineUsers);
  const candidates = await (q
    ? baseQuery
        .where(ilike(lineUsers.displayName, `%${escapeLike(q)}%`))
        .orderBy(sql`${lineUsers.lastMessageAt} DESC NULLS LAST`, lineUsers.id)
    : baseQuery.orderBy(sql`${lineUsers.lastMessageAt} DESC NULLS LAST`, lineUsers.id));

  // follow state derive จาก event ล่าสุดต่อคน — ดึง events ทีเดียวกัน N+1
  const ids = candidates.map((c) => c.id);
  const eventsByUser = new Map<string, { event: string; createdAt: Date }[]>();
  if (ids.length > 0) {
    const events = await db
      .select({
        lineUserId: lineFriendEvents.lineUserId,
        event: lineFriendEvents.event,
        createdAt: lineFriendEvents.createdAt,
      })
      .from(lineFriendEvents)
      .where(inArray(lineFriendEvents.lineUserId, ids))
      .orderBy(desc(lineFriendEvents.createdAt));
    for (const e of events) {
      const list = eventsByUser.get(e.lineUserId) ?? [];
      list.push({ event: e.event, createdAt: e.createdAt });
      eventsByUser.set(e.lineUserId, list);
    }
  }

  const enriched = candidates.map((c) => {
    const events = eventsByUser.get(c.id) ?? [];
    // desc อยู่แล้ว แถวแรก = ล่าสุด; ไม่มี event = เคย follow มาก่อน (แถว lineUsers เกิดจาก follow/message)
    const followState: FriendFollowState = events[0]?.event === 'unfollow' ? 'unfollowed' : 'following';
    let followCount = 0;
    let refollowCount = 0;
    let seenUnfollow = false;
    let lastFollowAt: Date | null = null;
    // § นิยาม refollow เดียวกับ getRefollowCount (ไล่เก่า→ใหม่: follow แรกไม่นับ ที่ตามหลัง unfollow นับ)
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]!;
      if (e.event === 'unfollow') {
        seenUnfollow = true;
      } else {
        followCount++;
        if (seenUnfollow) refollowCount++;
        lastFollowAt = e.createdAt;
      }
    }
    return {
      id: c.id,
      maskedId: c.maskedId,
      displayName: c.displayName,
      pictureUrl: c.pictureUrl,
      followState,
      followCount,
      refollowCount,
      lastActiveAt: c.lastMessageAt,
      lastFollowAt,
      richMenuId: (c.metadata as { richMenuId?: string } | null)?.richMenuId ?? null,
    };
  });

  const filtered = status === 'all' ? enriched : enriched.filter((r) => r.followState === status);
  const total = filtered.length;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ชื่อเมนูที่ผูกไว้รายคน — join ทีเดียวจาก metadata.richMenuId
  const menuIds = [...new Set(paged.map((r) => r.richMenuId).filter((v): v is string => v !== null))];
  const menuNames = new Map<string, string>();
  if (menuIds.length > 0) {
    const menus = await db
      .select({ id: richMenus.id, name: richMenus.name })
      .from(richMenus)
      .where(inArray(richMenus.id, menuIds));
    for (const m of menus) menuNames.set(m.id, m.name);
  }

  return NextResponse.json({
    items: paged.map((r) => ({
      ...r,
      richMenuName: r.richMenuId ? (menuNames.get(r.richMenuId) ?? null) : null,
    })),
    total,
    page,
    pageSize,
  });
}
