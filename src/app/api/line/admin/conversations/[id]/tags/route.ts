import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations, chatConversationTags } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { conversationTagsSchema } from '@/lib/validation';
import { parseBody } from '@/lib/api-helpers';
import { broadcast } from '@/lib/line/sse/broadcaster';

export const runtime = 'nodejs';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(conversationTagsSchema, request);
  if (!result.ok) return result.response;

  const { tagIds } = result.data;
  const { id } = await params;
  const db = await getDb();

  const [conversation] = await db
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1);

  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // replace-set: ลบทั้งชุดแล้วใส่ใหม่ใน transaction — semantics ตรงกับ chips editor
  await db.transaction(async (tx) => {
    await tx.delete(chatConversationTags).where(eq(chatConversationTags.conversationId, id));
    if (tagIds.length > 0) {
      await tx.insert(chatConversationTags).values(
        tagIds.map((tagId) => ({ id: generateId(), conversationId: id, tagId })),
      );
    }
  });

  broadcast({ type: 'conversation_update', conversationId: id, payload: { tags: true } });

  return NextResponse.json({ ok: true });
}
