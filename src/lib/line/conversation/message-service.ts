import { and, eq, gt, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { chatConversations, chatMessages, lineUsers } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type { ConversationMode } from '../chat-modes';
import { broadcast } from '../sse/broadcaster';
import type { LineOutgoingMessage } from '../types';
import { isHumanHandled } from './modes';
import type { LineTransport } from './transport';
import { resolveRawLineId } from '../identity';

export type InboundMessageType = 'text' | 'image' | 'file' | 'video' | 'audio' | 'location' | 'sticker';

export interface InboundMessage {
  conversationId: string;
  /** โหมด ณ ตอนรับข้อความ — ตัดสินว่าจะนับ unread ให้แอดมินไหม */
  mode: ConversationMode;
  messageType: InboundMessageType;
  textContent: string | null;
  mediaUrl?: string | null;
  mediaMetadata?: Record<string, unknown> | null;
  locationData: Record<string, unknown> | null;
  lineMessageId: string;
  /**
   * บังคับนับ/ไม่นับ unread ให้แอดมิน — ถ้าไม่ส่ง ใช้ isHumanHandled(mode) ตามเดิม
   * engine ส่ง true เมื่อ bot_enabled=false ทั้งที่ห้องยังเป็น bot_active (ข้อความนี้ไม่มีบอทตอบ
   * จึงต้องเข้าคิวเจ้าหน้าที่) — engine ต้องอ่าน bot_enabled ก่อนเรียกฟังก์ชันนี้
   */
  countUnread?: boolean;
}

/** แถวข้อความขาเข้าที่ redelivery เจอ — ครบพอให้ซ่อมต่อโดยไม่ต้องอ่านซ้ำ */
export interface InboundDupRow {
  id: string;
  createdAt: Date;
  messageType: string;
  mediaUrl: string | null;
  metadata: unknown;
}

/** หาแถวข้อความขาเข้าจาก LINE message id — redelivery หลัง crash ต้องเจอแถวเดิม ไม่ insert ซ้ำ */
export async function findInboundByLineMessageId(lineMessageId: string): Promise<InboundDupRow | null> {
  const db = await getDb();
  return (await firstOrUndefined(
    db
      .select({
        id: chatMessages.id,
        createdAt: chatMessages.createdAt,
        messageType: chatMessages.messageType,
        mediaUrl: chatMessages.mediaUrl,
        metadata: chatMessages.metadata,
      })
      .from(chatMessages)
      .where(eq(chatMessages.lineMessageId, lineMessageId))
      .limit(1),
  )) ?? null;
}

/** มีข้อความบอทตอบหลังเวลาที่กำหนดไหม — redelivery ที่ไม่เคยได้คำตอบต้องตอบซ่อม */
export async function hasBotReplyAfter(conversationId: string, after: Date): Promise<boolean> {
  const db = await getDb();
  const row = await firstOrUndefined(
    db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.sender, 'bot'), gt(chatMessages.createdAt, after)))
      .limit(1),
  );
  return row !== undefined;
}

interface InboundPayloadArgs {
  id: string;
  conversationId: string;
  messageType: InboundMessageType;
  textContent: string | null;
  mediaUrl: string | null;
  mediaMetadata: Record<string, unknown> | null;
}

/** shape เดียวของ new_message ทุกครั้ง — record กับ attach ต้องส่ง field ชุดเดียวกัน
 *  key `metadata` ตรงกับคอลัมน์ DB และ type ฝั่ง client (อย่าใช้ชื่ออื่นจะ mismatch เงียบ) */
function broadcastInbound(args: InboundPayloadArgs): void {
  broadcast({
    type: 'new_message',
    conversationId: args.conversationId,
    payload: {
      id: args.id,
      sender: 'user',
      messageType: args.messageType,
      textContent: args.textContent,
      mediaUrl: args.mediaUrl,
      metadata: args.mediaMetadata,
      createdAt: new Date().toISOString(),
    },
  });
}
export async function recordInboundMessage(input: InboundMessage): Promise<{ messageId: string; isNew: boolean }> {
  const db = await getDb();
  const messageId = generateId();
  const preview = input.textContent ?? `[${input.messageType}]`;

  // § แข่งกัน insert (redelivery ชนกัน) ให้ constraint ตัดสิน — แพ้แล้วไปเอาแถวผู้ชนะ
  // ไม่ throw ออกไป เพราะ throw ตรงนี้คือ event ล้มทั้งที่ข้อความอยู่ครบแล้ว
  const [inserted] = await db
    .insert(chatMessages)
    .values({
      id: messageId,
      conversationId: input.conversationId,
      sender: 'user',
      messageType: input.messageType,
      textContent: input.textContent,
      mediaUrl: input.mediaUrl ?? null,
      metadata: input.mediaMetadata ?? null,
      locationData: input.locationData,
      lineMessageId: input.lineMessageId,
    })
    .onConflictDoNothing({ target: chatMessages.lineMessageId, where: sql`line_message_id is not null` })
    .returning({ id: chatMessages.id });
  if (!inserted) {
    const winner = await findInboundByLineMessageId(input.lineMessageId);
    // § ชนะแต่หาแถวไม่เจอเป็นไปไม่ได้ นอกจากแถวถูกลบพร้อมกัน — ให้ webhook catch จัดการแล้ว redelivery ซ่อมทาง dup
    if (!winner) throw new Error(`inbound race lost with no winner: ${input.lineMessageId}`);
    return { messageId: winner.id, isNew: false };
  }

  const countUnread = input.countUnread ?? isHumanHandled(input.mode);
  await db
    .update(chatConversations)
    .set({
      lastMessageText: preview,
      lastMessageAt: new Date(),
      lastMessageSender: 'user',
      unreadAdmin: countUnread ? sql`${chatConversations.unreadAdmin} + 1` : 0,
      updatedAt: new Date(),
    })
    .where(eq(chatConversations.id, input.conversationId));

  broadcastInbound({
    id: messageId,
    conversationId: input.conversationId,
    messageType: input.messageType,
    textContent: input.textContent,
    mediaUrl: input.mediaUrl ?? null,
    mediaMetadata: input.mediaMetadata ?? null,
  });
  broadcast({ type: 'conversation_update', conversationId: input.conversationId, payload: { lastMessageText: preview } });

  return { messageId, isNew: true };
}

/**
 * แนบสื่อเข้ากับแถวข้อความที่บันทึกไว้แล้ว (record-first pattern)
 * ใช้ id เดิม broadcast ซ้ำ — client แทนที่ด้วย id จึงไม่ขึ้นซ้ำ
 */
export async function attachInboundMedia(
  messageId: string,
  conversationId: string,
  messageType: InboundMessageType,
  mediaUrl: string | null,
  mediaMetadata: Record<string, unknown> | null,
): Promise<void> {
  const db = await getDb();
  await db
    .update(chatMessages)
    .set({ mediaUrl, metadata: mediaMetadata })
    .where(eq(chatMessages.id, messageId));
  // § broadcast รูปเดิมใช้ shape เดียวกับตอน record — client แทนที่ด้วย id จึงไม่ขึ้นซ้ำ
  broadcastInbound({
    id: messageId,
    conversationId,
    messageType,
    textContent: null,
    mediaUrl,
    mediaMetadata,
  });
}

/**
 * บันทึกคำตอบของบอท — คงพฤติกรรมเดิมของ engine: ไม่อัปเดต last message และไม่ broadcast
 * เก็บ type ตรงกับข้อความที่ส่ง (ไม่ยุบเป็น flex) พร้อม payload เต็มใน metadata ให้ย้อนดูได้
 */
export async function recordBotReplies(conversationId: string, replies: LineOutgoingMessage[]): Promise<void> {
  if (replies.length === 0) return;
  const db = await getDb();

  await db.insert(chatMessages).values(
    replies.map((reply) => ({
      id: generateId(),
      conversationId,
      sender: 'bot' as const,
      messageType: reply.type,
      textContent: reply.type === 'text' ? reply.text : null,
      flexPayload: reply.type === 'flex' ? reply.contents : null,
      metadata: reply.type === 'text' || reply.type === 'flex' ? null : { reply },
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
  | { kind: 'pending'; messageId: string; pushStatus: 'sending' }
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
    .select({ id: chatConversations.id, lineUserIdHash: chatConversations.lineUserIdHash })
    .from(chatConversations)
    .where(eq(chatConversations.id, input.conversationId))
    .limit(1);
  if (!conv?.lineUserIdHash) return { kind: 'not_found' };

  const lineUser = await firstOrUndefined(
    db
      .select({ id: lineUsers.id })
      .from(lineUsers)
      .where(eq(lineUsers.lineUserIdHash, conv.lineUserIdHash))
      .limit(1),
  );
  const rawLineUserId = lineUser
    ? await resolveRawLineId(db, lineUser.id)
    : null;
  if (!rawLineUserId) {
    // § แยกสาเหตุ decrypt-null (แถว line_users หาย/key ผิด) ออกจาก push ล้ม — retry ไม่ช่วย
    console.error('[sendAdminReply] resolve raw LINE id ไม่ได้', {
      conversationId: input.conversationId,
      hasLineUser: Boolean(lineUser),
    });
    return { kind: 'push_failed', messageId: '', pushStatus: 'failed' };
  }

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
        await transport.push(rawLineUserId, [{ type: 'text', text: input.text }]);
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

  // § persist-ก่อน-push: insert แถว pending ก่อน แล้วค่อย push — ถ้า insert ล้มจะไม่มี
  // push หลุดออกไป (ghost message: ประชาชนได้ข้อความที่ไม่มีใน DB) ต่างจากลำดับเดิม
  // push → insert ที่ push สำเร็จแต่ insert ล้มแล้วกู้ไม่ได้
  const pending = await insertAdminMessage(db, conv, input, 'sending');
  if (pending.kind !== 'pending') return pending;
  try {
    await transport.push(rawLineUserId, [{ type: 'text', text: input.text }]);
  } catch {
    await markPushStatus(db, pending.messageId, 'failed');
    return { kind: 'push_failed', messageId: pending.messageId, pushStatus: 'failed' };
  }
  await markPushStatus(db, pending.messageId, 'sent');
  await touchConversationAdminReply(db, conv.id, input.text);
  broadcast({
    type: 'new_message',
    conversationId: conv.id,
    payload: {
      id: pending.messageId,
      sender: 'admin',
      messageType: 'text',
      textContent: input.text,
      adminUserId: input.adminUserId,
      clientTempId: input.clientTempId ?? null,
      createdAt: new Date().toISOString(),
    },
  });
  return { kind: 'sent', messageId: pending.messageId, pushStatus: 'sent' };
}

interface ReplyConv {
  id: string;
  lineUserIdHash: string | null;
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
  pushStatus: 'sending',
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

  // ถ้าแพ้ race (ชน unique client_temp_id) ให้ reuse แถวผู้ชนะจาก DB
  if (!inserted && input.clientTempId) {
    const [winner] = await db
      .select({ id: chatMessages.id, metadata: chatMessages.metadata })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.conversationId, conv.id),
          eq(chatMessages.clientTempId, input.clientTempId),
        ),
      )
      .limit(1);
    if (winner) {
      if (getPushStatus(winner.metadata) === 'failed') {
        return { kind: 'push_failed', messageId: winner.id, pushStatus: 'failed' };
      }
      return { kind: 'duplicate', messageId: winner.id, pushStatus: 'sent' };
    }
  }

  const finalId = inserted?.id ?? messageId;

  return { kind: 'pending', messageId: finalId, pushStatus: 'sending' };
}

async function markPushStatus(
  db: Awaited<ReturnType<typeof getDb>>,
  messageId: string,
  pushStatus: 'sent' | 'failed',
): Promise<void> {
  await db
    .update(chatMessages)
    .set({ metadata: { pushStatus } })
    .where(eq(chatMessages.id, messageId));
}

async function touchConversationAdminReply(
  db: Awaited<ReturnType<typeof getDb>>,
  conversationId: string,
  text: string,
): Promise<void> {
  await db
    .update(chatConversations)
    .set({
      lastMessageText: text,
      lastMessageAt: new Date(),
      lastMessageSender: 'admin',
      unreadAdmin: 0,
      updatedAt: new Date(),
    })
    .where(eq(chatConversations.id, conversationId));
}
