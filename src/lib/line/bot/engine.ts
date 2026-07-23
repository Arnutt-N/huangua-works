import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { lineUsers, chatConversations, chatMessages, cases } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { replyMessage, sendTypingIndicator } from '../client';
import type { LineWebhookEvent, LineMessageEvent, LineFollowEvent, LinePostbackEvent, LineOutgoingMessage } from '../types';
import { matchFaq } from './faq-matcher';
import { startCaseFlow, processCaseFlow, type CaseFlowState } from './case-flow';
import { isHandoffRequest, triggerHandoff } from './handoff';
import { getWelcomeMessages } from './welcome';
import { caseStatusFlex } from '../messages/flex';
import { broadcast } from '../sse/broadcaster';

type Db = Awaited<ReturnType<typeof getDb>>;

export async function handleEvent(event: LineWebhookEvent) {
  const userId = event.source.userId;
  if (!userId) return;

  const db = await getDb();
  const lineUser = await getOrCreateLineUser(db, userId);
  const conversation = await getOrCreateConversation(db, userId);

  switch (event.type) {
    case 'message':
      await handleMessageEvent(db, event, lineUser.id, conversation.id, conversation.mode);
      break;
    case 'follow':
      await handleFollowEvent(db, event, conversation.id);
      break;
    case 'postback':
      await handlePostbackEvent(db, event, conversation.id);
      break;
    case 'unfollow':
      break;
  }
}

async function getOrCreateLineUser(db: Db, lineUserId: string) {
  const [existing] = await db
    .select()
    .from(lineUsers)
    .where(eq(lineUsers.lineUserId, lineUserId))
    .limit(1);

  if (existing) return existing;

  const id = generateId();
  await db.insert(lineUsers).values({ id, lineUserId });
  return { id, lineUserId, botState: null };
}

async function getOrCreateConversation(db: Db, lineUserId: string) {
  const [existing] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.lineUserId, lineUserId))
    .limit(1);

  if (existing) return existing;

  const id = generateId();
  await db.insert(chatConversations).values({ id, lineUserId });
  return { id, lineUserId, mode: 'bot_active' as const };
}

async function handleMessageEvent(
  db: Db,
  event: LineMessageEvent,
  lineUserPk: string,
  conversationId: string,
  mode: string,
) {
  const msg = event.message;
  const textContent = msg.type === 'text' ? msg.text : null;
  const messageType = msg.type === 'text' ? 'text'
    : msg.type === 'image' ? 'image'
    : msg.type === 'location' ? 'location'
    : msg.type === 'sticker' ? 'sticker'
    : 'text';

  await db.insert(chatMessages).values({
    id: generateId(),
    conversationId,
    sender: 'user',
    messageType,
    textContent,
    locationData: msg.type === 'location'
      ? { title: msg.title, address: msg.address, latitude: msg.latitude, longitude: msg.longitude }
      : null,
    lineMessageId: msg.id,
  });

  await db
    .update(chatConversations)
    .set({
      lastMessageText: textContent ?? `[${messageType}]`,
      lastMessageAt: new Date(),
      lastMessageSender: 'user',
      unreadAdmin: mode === 'human_active' ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(chatConversations.id, conversationId));

  broadcast({
    type: 'new_message',
    conversationId,
    payload: { sender: 'user', messageType, textContent, createdAt: new Date().toISOString() },
  });
  broadcast({ type: 'conversation_update', conversationId, payload: { lastMessageText: textContent ?? `[${messageType}]` } });

  if (mode === 'human_active' || mode === 'waiting_handoff') {
    return;
  }

  await sendTypingIndicator(event.source.userId);

  const replies = await routeBotMessage(db, event, textContent, lineUserPk, conversationId);

  for (const reply of replies) {
    await db.insert(chatMessages).values({
      id: generateId(),
      conversationId,
      sender: 'bot',
      messageType: reply.type === 'text' ? 'text' : 'flex',
      textContent: reply.type === 'text' ? reply.text : null,
      flexPayload: reply.type === 'flex' ? reply.contents : null,
    });
  }

  await replyMessage(event.replyToken, replies.slice(0, 5));
}

async function routeBotMessage(
  db: Db,
  event: LineMessageEvent,
  text: string | null,
  lineUserPk: string,
  conversationId: string,
): Promise<LineOutgoingMessage[]> {
  if (!text) {
    if (event.message.type === 'location') {
      const [user] = await db.select().from(lineUsers).where(eq(lineUsers.id, lineUserPk)).limit(1);
      const botState = user?.botState as CaseFlowState | null;
      if (botState?.step === 'location') {
        const loc = event.message;
        const locText = loc.address ?? `${loc.latitude},${loc.longitude}`;
        const result = await processCaseFlow(locText, botState, event.source.userId);
        await updateBotState(db, lineUserPk, result.state);
        return result.replies;
      }
    }
    return [{ type: 'text', text: 'ได้รับแล้วครับ (รองรับข้อความและ location) พิมพ์ "แจ้งเรื่อง" เพื่อเริ่มแจ้งเรื่องร้องเรียน' }];
  }

  const normalized = text.trim().toLowerCase();

  if (isHandoffRequest(text)) {
    return triggerHandoff(conversationId);
  }

  if (normalized.includes('แจ้งเรื่อง') || normalized.includes('ร้องเรียน') || normalized === 'แจ้ง') {
    const { state, reply } = await startCaseFlow();
    await updateBotState(db, lineUserPk, state);
    return [reply];
  }

  if (normalized.startsWith('ติดตาม')) {
    const code = text.replace(/ติดตาม\s*/i, '').trim().toUpperCase();
    if (code) return trackCase(db, code);
    return [{ type: 'text', text: 'กรุณาระบุรหัสติดตาม เช่น "ติดตาม HN123456789"' }];
  }

  const [user] = await db.select().from(lineUsers).where(eq(lineUsers.id, lineUserPk)).limit(1);
  const botState = user?.botState as CaseFlowState | null;

  if (botState) {
    const result = await processCaseFlow(text, botState, event.source.userId);
    await updateBotState(db, lineUserPk, result.state);
    return result.replies;
  }

  const faqResult = await matchFaq(text);
  if (faqResult) {
    return [{ type: 'text', text: faqResult.answer }];
  }

  return [{
    type: 'text',
    text: 'ขออภัยครับ ไม่เข้าใจคำถาม\n\nลองพิมพ์:\n• "แจ้งเรื่อง" — แจ้งเรื่องร้องเรียน\n• "ติดตาม HNxxxxxxxxx" — ตรวจสอบสถานะ\n• "ติดต่อเจ้าหน้าที่" — พูดคุยกับเจ้าหน้าที่',
  }];
}

async function trackCase(db: Db, trackingCode: string): Promise<LineOutgoingMessage[]> {
  const [caseRow] = await db
    .select()
    .from(cases)
    .where(eq(cases.trackingCode, trackingCode))
    .limit(1);

  if (!caseRow) {
    return [{ type: 'text', text: `ไม่พบเรื่องรหัส ${trackingCode} กรุณาตรวจสอบรหัสอีกครั้ง` }];
  }

  return [caseStatusFlex(caseRow.trackingCode!, caseRow.status, caseRow.title)];
}

async function updateBotState(db: Db, lineUserPk: string, state: CaseFlowState | null) {
  await db
    .update(lineUsers)
    .set({ botState: state, updatedAt: new Date() })
    .where(eq(lineUsers.id, lineUserPk));
}

async function handleFollowEvent(db: Db, event: LineFollowEvent, conversationId: string) {
  const replies = getWelcomeMessages();

  await db.insert(chatMessages).values({
    id: generateId(),
    conversationId,
    sender: 'bot',
    messageType: 'text',
    textContent: (replies[0] as { type: 'text'; text: string }).text,
  });

  await replyMessage(event.replyToken, replies);
}

async function handlePostbackEvent(db: Db, event: LinePostbackEvent, conversationId: string) {
  await db.insert(chatMessages).values({
    id: generateId(),
    conversationId,
    sender: 'user',
    messageType: 'system',
    textContent: `[postback] ${event.postback.data}`,
    metadata: event.postback.params ?? null,
  });
}
