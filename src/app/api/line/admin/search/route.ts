import { NextResponse } from 'next/server';
import { desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatMessages, chatConversations, lineUsers } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { chatSearchQuerySchema, validateOrError } from '@/lib/validation';

export const runtime = 'nodejs';

/** escape LIKE metacharacters — กัน q ที่มี % / _ / \ ทำ pattern เพี้ยน */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function GET(request: Request) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const url = new URL(request.url);
  const validation = validateOrError(chatSearchQuerySchema, {
    q: url.searchParams.get('q') ?? '',
  });
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const db = await getDb();

  // ILIKE ตรงๆ พอสำหรับ scale อบต. (ข้อความหลักพัน) — ถ้าโตค่อยเพิ่ม pg_trgm index
  const rows = await db
    .select({
      conversationId: chatMessages.conversationId,
      messageId: chatMessages.id,
      textContent: chatMessages.textContent,
      sender: chatMessages.sender,
      createdAt: chatMessages.createdAt,
      displayName: lineUsers.displayName,
      lineUserId: chatConversations.lineUserId,
    })
    .from(chatMessages)
    .innerJoin(chatConversations, eq(chatMessages.conversationId, chatConversations.id))
    .leftJoin(lineUsers, eq(chatConversations.lineUserId, lineUsers.lineUserId))
    .where(ilike(chatMessages.textContent, `%${escapeLike(validation.data.q)}%`))
    .orderBy(desc(chatMessages.id))
    .limit(20);

  const items = rows.map((r) => ({
    conversationId: r.conversationId,
    messageId: r.messageId,
    snippet: (r.textContent ?? '').slice(0, 120),
    sender: r.sender,
    createdAt: r.createdAt,
    displayName: r.displayName,
    lineUserId: r.lineUserId,
  }));

  return NextResponse.json({ items });
}
