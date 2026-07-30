import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { broadcast } from '@/lib/line/sse/broadcaster';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();

  const [updated] = await db
    .update(chatConversations)
    .set({ unreadAdmin: 0, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
    .returning({ id: chatConversations.id });

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  broadcast({ type: 'conversation_update', conversationId: id, payload: { unreadAdmin: 0 } });

  return NextResponse.json({ ok: true });
}
