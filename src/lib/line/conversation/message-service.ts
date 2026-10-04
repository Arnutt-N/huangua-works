import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations, chatMessages } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type { ConversationMode } from '../chat-modes';
import { broadcast } from '../sse/broadcaster';
import type { LineOutgoingMessage } from '../types';
import { isHumanHandled } from './modes';
import type { LineTransport } from './transport';

export type InboundMessageType = 'text' | 'image' | 'location' | 'sticker';

export interface InboundMessage {
  conversationId: string;
  /** โหมด ณ ตอนรับข้อความ — ตัดสินว่าจะนับ unread ให้แอดมินไหม */
  mode: ConversationMode;
  messageType: InboundMessageType;
  textContent: string | null;
  locationData: Record<string, unknown> | null;
  lineMessageId: string;
}

/** บันทึกข้อความจากผู้ใช้ LINE + อัปเดตข้อความล่าสุดของห้อง + แจ้ง inbox แอดมิน */
export async function recordInboundMessage(input: InboundMessage): Promise<{ messageId: string }> {
  const db = await getDb();
  const messageId = generateId();
  const preview = input.textContent ?? `[${input.messageType}]`;

  await db.insert(chatMessages).values({
    id: messageId,
    conversationId: input.conversationId,
    sender: 'user',
    messageType: input.messageType,
    textContent: input.textContent,
    locationData: input.locationData,
    lineMessageId: input.lineMessageId,
  });

  await db
    .update(chatConversations)
    .set({
      lastMessageText: preview,
      lastMessageAt: new Date(),
      lastMessageSender: 'user',
      unreadAdmin: isHumanHandled(input.mode) ? sql`${chatConversations.unreadAdmin} + 1` : 0,
      updatedAt: new Date(),
    })
    .where(eq(chatConversations.id, input.conversationId));

  broadcast({
    type: 'new_message',
    conversationId: input.conversationId,
    payload: {
      id: messageId,
      sender: 'user',
      messageType: input.messageType,
      textContent: input.textContent,
      createdAt: new Date().toISOString(),
    },
  });
  broadcast({ type: 'conversation_update', conversationId: input.conversationId, payload: { lastMessageText: preview } });

  return { messageId };
}

/**
 * บันทึกคำตอบของบอท — คงพฤติกรรมเดิมของ engine: ไม่อัปเดต last message และไม่ broadcast
 * (ข้อความที่ไม่ใช่ text เก็บเป็น messageType 'flex' ตามเดิม)
 */
export async function recordBotReplies(conversationId: string, replies: LineOutgoingMessage[]): Promise<void> {
  if (replies.length === 0) return;
  const db = await getDb();

  await db.insert(chatMessages).values(
    replies.map((reply) => ({
      id: generateId(),
      conversationId,
      sender: 'bot' as const,
      messageType: reply.type === 'text' ? ('text' as const) : ('flex' as const),
      textContent: reply.type === 'text' ? reply.text : null,
      flexPayload: reply.type === 'flex' ? reply.contents : null,
    })),
  );
}

export interface AdminReplyInput {
  conversationId: string;
  adminUserId: string;
  text: string;
  /** client temp id — ส่งซ้ำด้วยค่าเดิมจะไม่ push ซ้ำ (กัน double-click / retry) */
  clientTempId?: string;
}

export type SendAdminReplyResult =
  | { kind: 'sent'; messageId: string; pushStatus: 'sent' }
  | { kind: 'duplicate'; messageId: string; pushStatus: 'sent' }
  | { kind: 'push_failed'; messageId: string; pushStatus: 'failed' }
  | { kind: 'not_found' };

/**
 * เจ้าหน้าที่ตอบประชาชน — push ผ่าน LINE + บันทึก + broadcast ให้ทุกแท็บที่เปิดห้องนี้
 * ลำดับ push-ก่อน-insert คงตาม route เดิม (เฉพาะตอบสำเร็จถึง broadcast)
 */
export async function sendAdminReply(
  input: AdminReplyInput,
  transport: LineTransport,
): Promise<SendAdminReplyResult> {
  const db = await getDb();
  const [conv] = await db
    .select({ id: chatConversations.id, lineUserId: chatConversations.lineUserId })
    .from(chatConversations)
    .where(eq(chatConversations.id, input.conversationId))
    .limit(1);
  if (!conv) return { kind: 'not_found' };

  // idempotency ตาม clientTempId — แถวที่มีอยู่แล้ว = retry: push ใหม่เฉพาะเมื่อครั้งก่อนพัง
  // (คง route เดิม: สำเร็จแล้วไม่ push ซ้ำ — ไม่งั้นประชาชนได้ข้อความเดิมสองรอบ)
  if (input.clientTempId) {
    const [existing] = await db
      .select({ id: chatMessages.id, metadata: chatMessages.metadata })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.conversationId, input.conversationId),
          eq(chatMessages.clientTempId, input.clientTempId),
        ),
      )
      .limit(1);
    if (existing) {
      if (getPushStatus(existing.metadata) !== 'failed') {
        return { kind: 'duplicate', messageId: existing.id, pushStatus: 'sent' };
      }
      try {
        await transport.push(conv.lineUserId, [{ type: 'text', text: input.text }]);
      } catch {
        return { kind: 'push_failed', messageId: existing.id, pushStatus: 'failed' };
      }
      await db
        .update(chatMessages)
        .set({ metadata: { pushStatus: 'sent' } })
        .where(eq(chatMessages.id, existing.id));
      return { kind: 'duplicate', messageId: existing.id, pushStatus: 'sent' };
    }
  }

  // § ไม่ใช้ tx: push LINE เป็น side effect นอก DB ที่ rollback ไม่ได้ — จัดลำดับ
  // push → insert → conversation → broadcast ให้แถวเดียวกับ route เดิมทุกประการ
  try {
    await transport.push(conv.lineUserId, [{ type: 'text', text: input.text }]);
  } catch {
    return insertAdminMessage(db, conv, input, 'failed', false);
  }
  return insertAdminMessage(db, conv, input, 'sent', true);
}

interface ReplyConv {
  id: string;
  lineUserId: string;
}

function getPushStatus(metadata: unknown): string | undefined {
  if (metadata && typeof metadata === 'object' && 'pushStatus' in metadata) {
    return (metadata as { pushStatus?: string }).pushStatus;
  }
  return undefined;
}

async function insertAdminMessage(
  db: Awaited<ReturnType<typeof getDb>>,
  conv: ReplyConv,
  input: AdminReplyInput,
  pushStatus: 'sent' | 'failed',
  shouldBroadcast: boolean,
): Promise<SendAdminReplyResult> {
  const messageId = generateId();
  const [inserted] = await db
    .insert(chatMessages)
    .values({
      id: messageId,
      conversationId: conv.id,
      sender: 'admin',
      messageType: 'text',
      textContent: input.text,
      adminUserId: input.adminUserId,
      clientTempId: input.clientTempId ?? null,
      metadata: { pushStatus },
    })
    // § race เดียวกับ route เดิม: สอง request ชน unique client_temp_id → คนแพ้ reuse แถวผู้ชนะ
    .onConflictDoNothing()
    .returning({ id: chatMessages.id });
  const finalId = inserted?.id ?? messageId;

  await db
    .update(chatConversations)
    .set({
      lastMessageText: input.text,
      lastMessageAt: new Date(),
      lastMessageSender: 'admin',
      unreadAdmin: 0,
      updatedAt: new Date(),
    })
    .where(eq(chatConversations.id, conv.id));

  if (!shouldBroadcast) return { kind: 'push_failed', messageId: finalId, pushStatus: 'failed' };

  broadcast({
    type: 'new_message',
    conversationId: conv.id,
    payload: {
      id: finalId,
      sender: 'admin',
      messageType: 'text',
      textContent: input.text,
      adminUserId: input.adminUserId,
      clientTempId: input.clientTempId ?? null,
      createdAt: new Date().toISOString(),
    },
  });
  return { kind: 'sent', messageId: finalId, pushStatus: 'sent' };
}
