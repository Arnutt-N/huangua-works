import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { lineUsers, chatConversations, chatMessages } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type { LineWebhookEvent, LineMessageEvent, LineFollowEvent, LinePostbackEvent, LineOutgoingMessage } from '../types';
import type { ConversationMode } from '../chat-modes';
import { matchFaq } from './faq-matcher';
import { matchIntent } from './intent-matcher';
import { parseResponseText } from './response-parser';
import { startCaseFlow, processCaseFlow, type CaseFlowState } from './case-flow';
import { isHandoffRequest, triggerHandoff } from './handoff';
import { getWelcomeMessages } from './welcome';
import { getChatSetting } from '../settings';
import { caseStatusFlex } from '../messages/flex';
import { getFaqReply } from '../messages/rich-menu';
import { findTrackableCase } from '@/lib/cases/citizen-access';
import { COPY } from '@/lib/copy';
import { isWithinBusinessHours, outsideBusinessHoursText } from '../business-hours';
import {
  changeMode,
  httpLineTransport,
  isHumanHandled,
  recordBotReplies,
  recordInboundMessage,
  type InboundMessageType,
  type LineTransport,
} from '../conversation';

type Db = Awaited<ReturnType<typeof getDb>>;

export async function handleEvent(event: LineWebhookEvent, transport: LineTransport = httpLineTransport) {
  const userId = event.source.userId;
  if (!userId) return;

  const db = await getDb();
  const lineUser = await getOrCreateLineUser(db, userId, transport);
  const conversation = await getOrCreateConversation(db, userId);

  switch (event.type) {
    case 'message':
      await handleMessageEvent(db, event, lineUser.id, conversation.id, conversation.mode, transport);
      break;
    case 'follow':
      await handleFollowEvent(db, event, conversation.id, transport);
      break;
    case 'postback':
      await handlePostbackEvent(db, event, conversation.id);
      break;
    case 'unfollow':
      break;
  }
}

const PROFILE_RETRY_MS = 24 * 60 * 60 * 1000; // ลองดึงโปรไฟล์ที่พลาดซ้ำได้วันละครั้ง

async function getOrCreateLineUser(db: Db, lineUserId: string, transport: LineTransport) {
  const [existing] = await db
    .select()
    .from(lineUsers)
    .where(eq(lineUsers.lineUserId, lineUserId))
    .limit(1);

  if (existing) {
    // backfill โปรไฟล์ให้ user เก่าที่ยังไม่มีชื่อ (best-effort — พังไม่ล้ม flow)
    // gate ด้วย profileCheckedAt กันยิง LINE API ซ้ำทุกข้อความเมื่อดึงไม่สำเร็จ
    const meta = (existing.metadata as { profileCheckedAt?: string } | null) ?? null;
    const lastCheck = meta?.profileCheckedAt ? Date.parse(meta.profileCheckedAt) : 0;
    const due = Date.now() - lastCheck > PROFILE_RETRY_MS;
    if (!existing.displayName && due) {
      const profile = await transport.getProfile(lineUserId).catch(() => null);
      await db
        .update(lineUsers)
        .set({
          ...(profile
            ? { displayName: profile.displayName, pictureUrl: profile.pictureUrl ?? null }
            : {}),
          metadata: { ...(meta ?? {}), profileCheckedAt: new Date().toISOString() },
        })
        .where(eq(lineUsers.id, existing.id));
    }
    return existing;
  }

  const id = generateId();
  const profile = await transport.getProfile(lineUserId).catch(() => null);
  await db.insert(lineUsers).values({
    id,
    lineUserId,
    displayName: profile?.displayName ?? null,
    pictureUrl: profile?.pictureUrl ?? null,
    metadata: { profileCheckedAt: new Date().toISOString() },
  });
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
  mode: ConversationMode,
  transport: LineTransport,
) {
  const msg = event.message;
  const messageType: InboundMessageType = msg.type === 'image' ? 'image'
    : msg.type === 'location' ? 'location'
    : msg.type === 'sticker' ? 'sticker'
    : 'text';

  // § อ่าน bot_enabled ก่อนบันทึกข้อความ — ถ้าบอทปิด ข้อความนี้ไม่มีใครตอบอัตโนมัติ
  // จึงต้องนับเป็น unread ของเจ้าหน้าที่ (เดิม reset เป็น 0 เพราะถือว่าบอทตอบแล้ว)
  const botEnabled = await getChatSetting('bot_enabled');
  const staffHandling = isHumanHandled(mode);

  await recordInboundMessage({
    conversationId,
    mode,
    messageType,
    textContent: msg.type === 'text' ? msg.text : null,
    locationData: msg.type === 'location'
      ? { title: msg.title, address: msg.address, latitude: msg.latitude, longitude: msg.longitude }
      : null,
    lineMessageId: msg.id,
    countUnread: staffHandling || !botEnabled,
  });

  if (staffHandling) {
    return;
  }

  if (!botEnabled) {
    await routeToStaffWhileBotDisabled(event.replyToken, conversationId, transport);
    return;
  }

  await transport.showTyping(event.source.userId);

  const replies = await routeBotMessage(db, event, msg.type === 'text' ? msg.text : null, lineUserPk, conversationId);
  await recordBotReplies(conversationId, replies);
  await transport.reply(event.replyToken, replies.slice(0, 5));
}

export const BOT_DISABLED_TEXT =
  'ขณะนี้ระบบตอบกลับอัตโนมัติปิดให้บริการชั่วคราว\nได้ส่งข้อความของท่านถึงเจ้าหน้าที่แล้ว เจ้าหน้าที่จะตอบกลับโดยเร็วที่สุดในเวลาทำการ';

// § บอทปิด → ย้ายห้องเข้าคิวเจ้าหน้าที่ (waiting_handoff) ผ่าน changeMode ของ c4
// ห้าม UPDATE mode ตรง — สอง event ที่อ่าน bot_active พร้อมกันจะส่ง notice สองครั้งและทับห้องที่ admin claim แทรก
// ตอบ notice เฉพาะผู้ที่ changeMode สำเร็จ (changed: true) คนที่แพ้ race ไม่ตอบซ้ำ
async function routeToStaffWhileBotDisabled(replyToken: string, conversationId: string, transport: LineTransport) {
  const changed = await changeMode(conversationId, 'waiting_handoff');
  if (!changed.ok || !changed.changed) return;

  await recordBotReplies(conversationId, [{ type: 'text', text: BOT_DISABLED_TEXT }]);
  await transport.reply(replyToken, [{ type: 'text', text: BOT_DISABLED_TEXT }]);
}

export async function routeBotMessage(
  db: Db,
  event: LineMessageEvent,
  text: string | null,
  lineUserPk: string,
  conversationId: string,
  now: Date = new Date(),
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
    return [{ type: 'text', text: 'ได้รับแล้วครับ (รองรับข้อความและ location) พิมพ์ "แจ้งเรื่องใหม่" เพื่อเริ่มแจ้งเรื่อง' }];
  }

  const normalized = text.trim().toLowerCase();

  if (
    normalized.includes('แจ้งเรื่อง') ||
    normalized.includes('ร้องเรียน') ||
    normalized === 'แจ้ง'
  ) {
    const { state, reply } = await startCaseFlow();
    await updateBotState(db, lineUserPk, state);
    return [reply];
  }

  if (normalized.startsWith('ติดตาม')) {
    const code = text.replace(/ติดตาม\s*/i, '').trim().toUpperCase();
    if (code) return trackCase(db, code);
    return [{ type: 'text', text: 'กรุณาระบุเลขติดตาม เช่น "ติดตาม HG123456789"' }];
  }

  // § ปุ่ม rich menu "คำถามที่พบบ่อย" ส่งข้อความนี้ — เดิมไม่มี handler ตก
  // fallback "ไม่เข้าใจคำถาม" (audit พบ) จัดการตรงนี้เลยให้ตอบ FAQ ได้จริง
  // § match แบบ exact เท่านั้น — includes('faq') เดิมกว้างเกิน (audit: ข้อความ
  // อื่นที่มี substring โดน short-circuit ข้าม handoff/case-flow recovery)
  if (normalized === COPY.FAQ_LABEL || normalized === 'faq') {
    return [getFaqReply()];
  }

  const [user] = await db.select().from(lineUsers).where(eq(lineUsers.id, lineUserPk)).limit(1);
  const botState = user?.botState as CaseFlowState | null;

  if (botState) {
    const result = await processCaseFlow(text, botState, event.source.userId);
    await updateBotState(db, lineUserPk, result.state);
    return result.replies;
  }

  const engineV2 = await getChatSetting('bot_engine_v2');
  if (engineV2) {
    const intentResult = await matchIntent(text);
    if (intentResult) {
      return intentResult.responses;
    }
  }

  const faqResult = await matchFaq(text);
  if (faqResult) {
    return parseResponseText(faqResult.answer);
  }

  if (await isHandoffRequest(text)) {
    // § นอกเวลาทำการไม่ย้ายเข้า waiting_handoff — ไม่งั้นบอทจะเงียบทั้งคืน (แม้ผู้ใช้พิมพ์
    // "ติดตาม …") จนเจ้าหน้าที่เข้างาน บอกตรง ๆ ว่านอกเวลาแล้วให้ใช้บริการอัตโนมัติไปก่อน
    const hours = await getChatSetting('business_hours');
    if (!isWithinBusinessHours(hours, now)) {
      return [{ type: 'text', text: outsideBusinessHoursText(hours) }];
    }
    return triggerHandoff(conversationId);
  }

  return [{
    type: 'text',
    text: 'ขออภัยครับ ไม่เข้าใจคำถาม\n\nลองพิมพ์:\n• "แจ้งเรื่องใหม่" — แจ้งเรื่อง\n• "ติดตาม HGxxxxxxxxx" — ตรวจสอบสถานะ\n• "ติดต่อเจ้าหน้าที่" — พูดคุยกับเจ้าหน้าที่',
  }];
}

async function trackCase(db: Db, trackingCode: string): Promise<LineOutgoingMessage[]> {
  // § normalize (เลขที่พิมพ์มีเว้นวรรค เช่น HG 4837 2915 6) + กติกาความยินยอม + audit
  // อยู่ใน citizen-access — เดิมบอทค้นตรงไม่เช็คความยินยอม เรื่องที่เจ้าของถอนแล้ว
  // ยังโชว์หัวเรื่อง+สถานะผ่านแชทได้ ทั้งที่เว็บตอบ 404
  const view = await findTrackableCase(trackingCode, { channel: 'line_bot' }, db);
  if (!view) {
    return [{ type: 'text', text: `ไม่พบเรื่องเลข ${trackingCode} กรุณาตรวจสอบเลขติดตามอีกครั้ง` }];
  }
  return [caseStatusFlex(view.case.trackingCode, view.case.status, view.case.title)];
}

async function updateBotState(db: Db, lineUserPk: string, state: CaseFlowState | null) {
  await db
    .update(lineUsers)
    .set({ botState: state, updatedAt: new Date() })
    .where(eq(lineUsers.id, lineUserPk));
}

async function handleFollowEvent(db: Db, event: LineFollowEvent, conversationId: string, transport: LineTransport) {
  const replies = await getWelcomeMessages();

  // คงพฤติกรรมเดิม: บันทึกแค่ข้อความแรกเป็น text
  await db.insert(chatMessages).values({
    id: generateId(),
    conversationId,
    sender: 'bot',
    messageType: 'text',
    textContent: (replies[0] as { type: 'text'; text: string }).text,
  });

  await transport.reply(event.replyToken, replies);
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
