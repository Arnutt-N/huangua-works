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
 * § refollow นิยามแบบ derive — จำนวนครั้งที่ผู้ใช้กลับมา follow หลังเคย unfollow มาก่อน
 * (follow แรกไม่นับ, follow ที่สองขึ้นไปที่ตามหลัง unfollow อย่างน้อยหนึ่งครั้งนับ)
 */
export async function getRefollowCount(
  db: Awaited<ReturnType<typeof getDb>>,
  lineUserPk: string,
): Promise<number> {
  const rows = await db
    .select({ event: lineFriendEvents.event, createdAt: lineFriendEvents.createdAt })
    .from(lineFriendEvents)
    .where(eq(lineFriendEvents.lineUserId, lineUserPk))
    .orderBy(lineFriendEvents.createdAt);
  let seenUnfollow = false;
  let refollows = 0;
  for (const row of rows) {
    if (row.event === 'unfollow') seenUnfollow = true;
    else if (seenUnfollow) refollows++;
  }
  return refollows;
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
