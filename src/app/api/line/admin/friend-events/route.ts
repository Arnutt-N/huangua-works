import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { lineFriendEvents, lineUsers } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';

export const runtime = 'nodejs';

const querySchema = z.object({
  lineUserId: z.string().trim().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

/**
 * § คืน maskedId (8 ตัวแรกของ Enc) เท่านั้น — ห้ามเผย raw LINE id ตรง convention
 *   mask-audit ของ conversations/friends route
 */
export async function GET(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    lineUserId: url.searchParams.get('lineUserId') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'พารามิเตอร์ไม่ถูกต้อง' },
      { status: 400 },
    );
  }
  const { lineUserId, limit } = parsed.data;

  const db = await getDb();

  const conditions = [];
  if (lineUserId) conditions.push(eq(lineFriendEvents.lineUserId, lineUserId));

  const rows = await db
    .select({
      id: lineFriendEvents.id,
      lineUserId: lineFriendEvents.lineUserId,
      event: lineFriendEvents.event,
      createdAt: lineFriendEvents.createdAt,
      displayName: lineUsers.displayName,
      pictureUrl: lineUsers.pictureUrl,
      maskedId: sql<string | null>`left(${lineUsers.lineUserIdEnc}, 8)`,
    })
    .from(lineFriendEvents)
    .leftJoin(lineUsers, eq(lineFriendEvents.lineUserId, lineUsers.id))
    .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined)
    .orderBy(desc(lineFriendEvents.createdAt))
    .limit(limit);

  return NextResponse.json({ items: rows });
}
