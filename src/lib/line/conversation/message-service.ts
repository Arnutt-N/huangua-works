import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations, chatMessages } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type { ConversationMode } from '../chat-modes';
import { broadcast } from '../sse/broadcaster';
import type { LineOutgoingMessage } from '../types';
import { isHumanHandled } from './modes';

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
