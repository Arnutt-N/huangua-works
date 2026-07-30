import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatMessages, chatConversations } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { chatReplySchema, validateOrError } from '@/lib/validation';
import { pushMessage } from '@/lib/line/client';
import { broadcast } from '@/lib/line/sse/broadcaster';

export const runtime = 'nodejs';

type PushStatus = 'pending' | 'sent' | 'failed';

function getPushStatus(metadata: unknown): PushStatus | undefined {
  if (metadata && typeof metadata === 'object' && 'pushStatus' in metadata) {
    return (metadata as { pushStatus?: PushStatus }).pushStatus;
  }
  return undefined;
}

async function pushAndRecord(
  db: Awaited<ReturnType<typeof getDb>>,
  messageId: string,
  lineUserId: string,
  text: string,
): Promise<PushStatus> {
  let status: PushStatus;
  try {
    await pushMessage(lineUserId, [{ type: 'text', text }]);
    status = 'sent';
  } catch (error) {
    console.error('[admin-chat] pushMessage failed', { messageId, error });
    status = 'failed';
  }
  await db
    .update(chatMessages)
    .set({ metadata: sql`coalesce(${chatMessages.metadata}, '{}'::jsonb) || ${JSON.stringify({ pushStatus: status })}::jsonb` })
    .where(eq(chatMessages.id, messageId));
  return status;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = validateOrError(chatReplySchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { text, clientTempId } = validation.data;
  const { id } = await params;

  const db = await getDb();

  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1);

  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // idempotent retry: เคย insert ด้วย tempId เดิมแล้ว → ไม่สร้างซ้ำ
  // retry push เฉพาะเมื่อครั้งก่อน push พังจริง (pushStatus=failed)
  if (clientTempId) {
    const [existing] = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.conversationId, id),
          eq(chatMessages.clientTempId, clientTempId),
        ),
      )
      .limit(1);

    if (existing) {
      let pushStatus = getPushStatus(existing.metadata);
      if (pushStatus === 'failed') {
        pushStatus = await pushAndRecord(db, existing.id, conversation.lineUserId, existing.textContent ?? text);
        if (pushStatus === 'failed') {
          return NextResponse.json(
            { error: 'ส่งข้อความไป LINE ไม่สำเร็จ', messageId: existing.id, pushStatus },
            { status: 502 },
          );
        }
      }
      return NextResponse.json({ ok: true, messageId: existing.id, pushStatus, duplicate: true });
    }
  }

  const messageId = generateId();
  const inserted = await db
    .insert(chatMessages)
    .values({
      id: messageId,
      conversationId: id,
      sender: 'admin',
      messageType: 'text',
      textContent: text,
      adminUserId: authz.ctx.user.id,
      clientTempId: clientTempId ?? null,
      metadata: { pushStatus: 'pending' satisfies PushStatus },
    })
    .onConflictDoNothing()
    .returning({ id: chatMessages.id });

  // แพ้ race กับ retry ที่วิ่งพร้อมกัน (ชน unique client_temp_id) — อีก request เป็นผู้ส่ง
  if (inserted.length === 0 && clientTempId) {
    const [winner] = await db
      .select({ id: chatMessages.id, metadata: chatMessages.metadata })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.conversationId, id),
          eq(chatMessages.clientTempId, clientTempId),
        ),
      )
      .limit(1);
    return NextResponse.json({
      ok: true,
      messageId: winner?.id,
      pushStatus: getPushStatus(winner?.metadata),
      duplicate: true,
    });
  }

  await db
    .update(chatConversations)
    .set({
      lastMessageText: text,
      lastMessageAt: new Date(),
      lastMessageSender: 'admin',
      unreadAdmin: 0,
      updatedAt: new Date(),
    })
    .where(eq(chatConversations.id, id));

  const pushStatus = await pushAndRecord(db, messageId, conversation.lineUserId, text);

  if (pushStatus === 'failed') {
    // ข้อความอยู่ใน DB แล้ว — client retry ด้วย tempId เดิมจะเข้า path retry push ไม่สร้างซ้ำ
    return NextResponse.json(
      { error: 'ส่งข้อความไป LINE ไม่สำเร็จ', messageId, pushStatus },
      { status: 502 },
    );
  }

  broadcast({
    type: 'new_message',
    conversationId: id,
    payload: {
      id: messageId,
      sender: 'admin',
      messageType: 'text',
      textContent: text,
      clientTempId: clientTempId ?? null,
      createdAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ ok: true, messageId, pushStatus });
}
