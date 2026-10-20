import { eq, count, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { lineFriendEvents } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

// § บันทึก follow/unfollow แบบทนการส่งซ้ำ — unique webhook_event_id + ON CONFLICT DO NOTHING
// ทำให้ redelivery หลัง Redis dedup TTL หมดไม่สร้างแถวซ้ำ (engine ห่อ best-effort กัน welcome ล้ม)
export async function recordFriendEvent(
  db: Awaited<ReturnType<typeof getDb>>,
  lineUserPk: string,
  event: 'follow' | 'unfollow',
  webhookEventId: string,
): Promise<boolean> {
  const inserted = await db
    .insert(lineFriendEvents)
    .values({ id: generateId(), lineUserId: lineUserPk, event, webhookEventId })
    .onConflictDoNothing({ target: lineFriendEvents.webhookEventId })
    .returning({ id: lineFriendEvents.id });
  return inserted.length > 0;
}

/**
 * § pure kernel นับ follow/refollow จาก events — getRefollowCount/getFollowCount กับหน้า friends
 * ใช้ตัวเดียวกันนิยามจะได้ไม่ drift ไปคนละทางเมื่อเจอ edge case ใหม่
 * รับ events เรียงเก่า→ใหม่; follow แรกไม่นับ refollow ที่ตามหลัง unfollow นับ
 */
export interface FollowEventLike {
  event: string;
  createdAt: Date;
}

export function countFollowStats(eventsOldestFirst: FollowEventLike[]): {
  followCount: number;
  refollowCount: number;
  lastFollowAt: Date | null;
} {
  let followCount = 0;
  let refollowCount = 0;
  let seenUnfollow = false;
  let lastFollowAt: Date | null = null;
  for (const e of eventsOldestFirst) {
    if (e.event === 'unfollow') {
      seenUnfollow = true;
    } else {
      followCount++;
      if (seenUnfollow) refollowCount++;
      lastFollowAt = e.createdAt;
    }
  }
  return { followCount, refollowCount, lastFollowAt };
}

export async function getRefollowCount(
  db: Awaited<ReturnType<typeof getDb>>,
  lineUserPk: string,
): Promise<number> {
  const rows = await db
    .select({ event: lineFriendEvents.event, createdAt: lineFriendEvents.createdAt })
    .from(lineFriendEvents)
    .where(eq(lineFriendEvents.lineUserId, lineUserPk))
    .orderBy(lineFriendEvents.createdAt);
  return countFollowStats(rows).refollowCount;
}

/** จำนวน follow ทั้งหมดของผู้ใช้ — ใช้แทน placeholder {follow_count} ในข้อความต้อนรับ */
export async function getFollowCount(
  db: Awaited<ReturnType<typeof getDb>>,
  lineUserPk: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(lineFriendEvents)
    .where(sql`${lineFriendEvents.lineUserId} = ${lineUserPk} AND ${lineFriendEvents.event} = 'follow'`);
  return row?.value ?? 0;
}
