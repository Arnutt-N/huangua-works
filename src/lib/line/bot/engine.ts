import { and, eq } from 'drizzle-orm';
import { getDb, type DbOrTx } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { lineUsers, chatConversations, chatMessages, lineWebhookEvents } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type { LineWebhookEvent, LineMessageEvent, LineFollowEvent, LinePostbackEvent, LineOutgoingMessage } from '../types';
import type { ConversationMode } from '../chat-modes';
import { matchFaq } from './faq-matcher';
import { ingestLineMedia } from '../media-ingest';
import { csatThankYou, parseCsatPostback, recordCsatResponse } from '../chat/csat';
import { matchIntent } from './intent-matcher';
import { ensureLineUser, findLineUserByRaw, lookupHash } from '../identity';
import { parseResponseText } from './response-parser';
import { startCaseFlow, processCaseFlow, handleConfirmPostback, type CaseFlowState } from './case-flow';
import { isHandoffRequest, triggerHandoff } from './handoff';
import { getWelcomeMessages } from './welcome';
import { getChatSetting } from '../settings';
import { caseStatusFlex, parseConfirmPostback } from '../messages/flex';
import { getFaqReply } from '../messages/rich-menu';
import { findTrackableCaseStatus } from '@/lib/cases/citizen-access';
import { COPY } from '@/lib/copy';
import { isWithinBusinessHours, outsideBusinessHoursText } from '../business-hours';
import { getFollowCount, recordFriendEvent } from '../friend-events';
import {
  claimNextWebhookEvent,
  commitEffects,
  expireReply,
  markDone,
  markFailed,
  renewLease,
  restoreEvent,
  BarrierDeferred,
} from '../webhook-events';
import type { WebhookEventRow } from '../webhook-events';
import {
  changeMode,
  httpLineTransport,
  attachInboundMedia,
  findInboundByLineMessageId,
  isHumanHandled,
  recordInboundMessage,
  type InboundMessageType,
  type LineTransport,
} from '../conversation';

type Db = Awaited<ReturnType<typeof getDb>>;

/** bot reply writer ใช้ db ที่รับมา — helpers ทุกตัวใน effects ต้องอยู่ใน transaction เดียวกัน */
async function persistBotReplies(db: DbOrTx, conversationId: string, replies: LineOutgoingMessage[]) {
  if (replies.length === 0) return;
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

/** § compatibility path — process ตรง (route ใช้ enqueue + processWebhookEvents แล้ว) */
export async function handleEvent(event: LineWebhookEvent, transport: LineTransport = httpLineTransport) {
  const db = await getDb();
  const replies = await runEventEffects(db, event, transport);
  const replyToken = 'replyToken' in event ? event.replyToken : '';
  if (replies.length > 0 && replyToken) await transport.reply(replyToken, replies.slice(0, 5));
}

/**
 * § all-inbound effects อยู่ใน transaction เดียว ภายใต้ lock ต่อ user — เฉพาะ reply
 * ที่ถูกส่งจริงเท่านั้นที่อยู่นอก transaction (LINE API ไม่ใช่ DB effect)
 */
export async function runEventEffects(db: DbOrTx, event: LineWebhookEvent, transport: LineTransport = httpLineTransport) {
  const userId = event.source.userId;
  if (!userId) return [];

  // § bot ปิด → routeToStaffWhileBotDisabled ส่ง typing เอง — อย่าส่งซ้ำตรงนี้
  // § transport effect อยู่นอก effects transaction — retry หลัง commit ต้องไม่ยิง typing ซ้ำ
  const botEnabled = await getChatSetting('bot_enabled');
  if (botEnabled && event.type === 'message' && event.message.type !== 'sticker') {
    await transport.showTyping(userId);
  }

  const lineUser = await getOrCreateLineUser(db, userId, transport);
  const conversation = await getOrCreateConversation(db, userId);

  switch (event.type) {
    case 'message': {
      return handleMessageEvent(db, event, lineUser.id, conversation.id, conversation.mode);
    }
    case 'follow':
      return handleFollowEvent(db, event, lineUser.id, conversation.id, transport);
    case 'postback':
      return handlePostbackEvent(db, event, conversation.id);
    case 'unfollow':
      // § บันทึก event อย่างเดียว ไม่ตอบกลับ (unfollow ไม่มี replyToken ให้ใช้อยู่แล้ว)
      await recordFriendEvent(db, lineUser.id, 'unfollow', event.webhookEventId).catch(() => false);
      return [];
  }
}

export interface ProcessWebhookResult {
  attempted: number;
  done: number;
  retried: number;
  failed: number;
  deferred: number;
}

/**
 * § recovery + inline processing ทางเดียว: ตาม timestamp แล้ว id เสมอ หนึ่ง try/catch ต่อ event
 * ก่อน commit ถ้าพัง → pending row ยังอยู่ (retry ไม่ duplicate inbound)
 * หลัง commit ถ้าพัง → pendingReplies ยังอยู่ (retry ส่ง reply โดยไม่ทำ effects ซ้ำ)
 */
export async function processWebhookEvents(
  limit = 20,
  transport: LineTransport = httpLineTransport,
): Promise<ProcessWebhookResult> {
  const result = { attempted: 0, done: 0, retried: 0, failed: 0, deferred: 0 };
  const rows = await claimNextWebhookEvent(limit);
  for (const row of rows) {
    result.attempted++;
    // § claim ต้องมี owner — ไม่มี owner ห้ามแตะแถวหรือเปลี่ยนสถานะใด ๆ
    if (!row.leaseOwner) {
      result.deferred++;
      continue;
    }
    try {
      await processOne(row, row.leaseOwner, transport);
      result.done++;
    } catch (error) {
      if (!await renewLease(row.id, row.leaseOwner)) {
        // § เสีย lease ระหว่างทาง → คนอื่นรับช่วงไปแล้ว ห้ามมาเขียนสถานะ/ reply ทับ
        result.deferred++;
      } else if (error instanceof BarrierDeferred) {
        // § event เก่ายังไม่ commit — คืน pending โดยไม่เพิ่ม attempts (cron รอบหน้าลองใหม่)
        result.deferred++;
        await releaseLease(row.id, row.leaseOwner);
      } else {
        console.error('[line-webhook] event failed', { id: row.id, error });
        await markFailed(row.id, row.attempts, row.leaseOwner);
        if (row.attempts >= 5) result.failed++;
        else result.retried++;
      }
    }
  }
  return result;
}

async function releaseLease(id: string, owner: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.update(lineWebhookEvents)
    .set({ status: 'pending', leaseUntil: null, leaseOwner: null, updatedAt: new Date() })
    .where(and(eq(lineWebhookEvents.id, id), eq(lineWebhookEvents.leaseOwner, owner)))
    .returning({ id: lineWebhookEvents.id });
  return rows.length > 0;
}

async function processOne(row: WebhookEventRow, owner: string, transport: LineTransport): Promise<void> {
  const db = await getDb();

  // § ต่ออายุ lease ก่อนแตะแถว — ownership เป็น capability ที่ต้องมีทุกขั้นตอน ไม่ใช่แค่ตอน claim
  if (!await renewLease(row.id, owner)) return;

  // § recovery หลัง effects commit — ส่ง pendingReplies ซ้ำโดยไม่ทำ effects อีก
  if (row.replyState === 'none' && row.effectsCommittedAt) {
    if (!await markDone(row.id, owner, 'none')) return;
    return;
  }
  if (row.replyState === 'expired') {
    // § token หมดอายุ/ใช้ไปแล้ว — terminal ทันที ไม่ยิง transport และไม่ให้ cron รี retry
    await expireReply(row.id, owner);
    return;
  }
  if (row.pendingReplies && row.pendingReplies.length > 0) {
    if (!row.replyToken) {
      await expireReply(row.id, owner);
      return;
    }
    if (!await renewLease(row.id, owner)) return;
    await transport.reply(row.replyToken, row.pendingReplies.slice(0, 5));
    await markDone(row.id, owner, 'pending');
    return;
  }

  // § ต่ออายุอีกครั้งหลัง network I/O ของ reply ก่อนเข้า effects transaction
  if (!await renewLease(row.id, owner)) return;

  let replies: LineOutgoingMessage[] = [];
  await db.transaction(async (tx) => {
    // § payload เก็บ hash — ถอด raw จาก line_users.lineUserIdEnc ก่อนส่งเข้า engine
    const restored = await restoreEvent(tx, row);
    const outcome = await commitEffects(tx, row, async () => {
      const out = await runEventEffects(tx, restored, transport);
      return { replies: out };
    });
    replies = outcome?.replies ?? [];
  });
  if (!await renewLease(row.id, owner)) return;

  if (replies.length > 0 && row.replyToken) {
    await transport.reply(row.replyToken, replies.slice(0, 5));
    await markDone(row.id, owner, 'pending');
    return;
  }
  // § ไม่มี replies หรือไม่มี token (unfollow) → ปิดงานโดยไม่ยิง transport
  await markDone(row.id, owner, replies.length > 0 ? 'expired' : 'none');
}

const PROFILE_RETRY_MS = 24 * 60 * 60 * 1000; // ลองดึงโปรไฟล์ที่พลาดซ้ำได้วันละครั้ง

async function getOrCreateLineUser(db: DbOrTx, lineUserId: string, transport: LineTransport) {
  const existing = await findLineUserByRaw(db, lineUserId);

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

  // § identity ต้องผ่าน ensureLineUser ตัวเดียวกับ ingress — ห้าม pseudonymize ซ้ำที่นี่
  const user = await ensureLineUser(db, lineUserId);
  // § กันยิง getProfile ซ้ำทุกข้อความเมื่อ ingress สร้าง user ไว้แล้วแต่ยังไม่มีชื่อ
  const meta = (user.metadata as { profileCheckedAt?: string } | null) ?? null;
  const due = !user.displayName && Date.now() - (meta?.profileCheckedAt ? Date.parse(meta.profileCheckedAt) : 0) > PROFILE_RETRY_MS;
  if (due) {
    const profile = await transport.getProfile(lineUserId).catch(() => null);
    await db.update(lineUsers)
      .set({
        ...(profile ? { displayName: profile.displayName, pictureUrl: profile.pictureUrl ?? null } : {}),
        metadata: { ...meta, profileCheckedAt: new Date().toISOString() },
      })
      .where(eq(lineUsers.id, user.id));
  }
  return { id: user.id, botState: user.botState ?? null };
}

async function getOrCreateConversation(db: DbOrTx, lineUserId: string) {
  const hash = lookupHash(lineUserId);
  const [found] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.lineUserIdHash, hash))
    .limit(1);
  if (found) {
    return found;
  }

  const id = generateId();
  // § race เดียวกับ getOrCreateLineUser — ON CONFLICT แล้วอ่านแถวผู้ชนะ
  const inserted = await db.insert(chatConversations).values({ id, lineUserIdHash: hash, })
    .onConflictDoNothing({ target: chatConversations.lineUserIdHash })
    .returning({ id: chatConversations.id });
  const winnerId = inserted[0]?.id ?? (await firstOrUndefined(
    db.select({ id: chatConversations.id }).from(chatConversations)
      .where(eq(chatConversations.lineUserIdHash, hash)).limit(1),
  ))?.id ?? id;
  const [winner] = await db.select().from(chatConversations).where(eq(chatConversations.id, winnerId)).limit(1);
  return winner ?? { id: winnerId, mode: 'bot_active' as const };
}

async function handleMessageEvent(
  db: DbOrTx,
  event: LineMessageEvent,
  lineUserPk: string,
  conversationId: string,
  mode: ConversationMode,
): Promise<LineOutgoingMessage[]> {
  const msg = event.message;
  const messageType: InboundMessageType = msg.type === 'image' ? 'image'
    : msg.type === 'file' ? 'file'
    : msg.type === 'video' ? 'video'
    : msg.type === 'audio' ? 'audio'
    : msg.type === 'location' ? 'location'
    : msg.type === 'sticker' ? 'sticker'
    : 'text';

  // § duplicate path: redelivery ผ่าน durable queue แล้วจะเจอ dedupKey เดิม (ON CONFLICT DO NOTHING)
  // จึงไม่ต้อง repairDuplicate — effects commit แล้ว row เดิมมี pendingReplies/done ให้ส่งต่อ
  const dup = await findInboundByLineMessageId(db, msg.id);
  if (dup) return [];

  // § record-first: บันทึกแถวข้อความก่อนดึงสื่อเสมอ — crash กลาง ingest จะเหลือแถวให้ redelivery
  // เห็น ไม่ใช่หายทั้งข้อความ (dedup mark ก่อน process จึงต้องมีแถวรอก่อน) ingest เสร็จค่อยแนบทับ
  // ด้วย id เดิม (client แทนที่ด้วย id ไม่ขึ้นซ้ำ) ทุกทางล้มของ ingest จบที่ skipped ไม่ throw
  const isMedia = msg.type === 'image' || msg.type === 'file' || msg.type === 'video' || msg.type === 'audio';

  // § อ่าน bot_enabled ก่อนบันทึกข้อความ — ถ้าบอทปิด ข้อความนี้ไม่มีใครตอบอัตโนมัติ
  // จึงต้องนับเป็น unread ของเจ้าหน้าที่ (เดิม reset เป็น 0 เพราะถือว่าบอทตอบแล้ว)
  const botEnabled = await getChatSetting('bot_enabled');
  const staffHandling = isHumanHandled(mode);

  // § ใช้ db ที่รับมา (tx ได้) — ทุก write ต้อง commit/rollback พร้อม effects transaction
  // ตัวมัน idempotent ด้วย lineMessageId unique อยู่แล้ว retry จึงไม่ซ้ำ
  const { messageId, isNew } = await recordInboundMessage(db, {
    conversationId,
    mode,
    messageType,
    textContent: msg.type === 'text' ? msg.text : null,
    mediaUrl: null,
    mediaMetadata: null,
    locationData: msg.type === 'location'
      ? { title: msg.title, address: msg.address, latitude: msg.latitude, longitude: msg.longitude }
      : null,
    lineMessageId: msg.id,
    countUnread: staffHandling || !botEnabled,
  });
  if (!isNew) return [];

  if (isMedia) {
    const knownSize = msg.type === 'file' ? msg.fileSize : undefined;
    const ingested = await ingestLineMedia(msg.id, undefined, { knownSize });
    if (ingested.kind === 'stored') {
      await attachInboundMedia(db, messageId, conversationId, messageType, ingested.url, {
        contentType: ingested.contentType,
        sizeBytes: ingested.sizeBytes,
        ...(msg.type === 'file' ? { fileName: msg.fileName } : {}),
      });
    } else {
      await attachInboundMedia(db, messageId, conversationId, messageType, null, { skipped: ingested.reason });
    }
  }

  if (staffHandling) return [];

  if (!botEnabled) {
    return routeToStaffWhileBotDisabled(db, conversationId);
  }

  const routed = await routeBotMessage(db, event, msg.type === 'text' ? msg.text : null, lineUserPk, conversationId);
  if (routed.state !== undefined) await updateBotState(db, lineUserPk, routed.state);
  await persistBotReplies(db, conversationId, routed.replies);
  return routed.replies;
}

export const BOT_DISABLED_TEXT =
  'ขณะนี้ระบบตอบกลับอัตโนมัติปิดให้บริการชั่วคราว\nได้ส่งข้อความของท่านถึงเจ้าหน้าที่แล้ว เจ้าหน้าที่จะตอบกลับโดยเร็วที่สุดในเวลาทำการ';

// § บอทปิด → ย้ายห้องเข้าคิวเจ้าหน้าที่ (waiting_handoff) ผ่าน changeMode ของ c4
// ห้าม UPDATE mode ตรง — สอง event ที่อ่าน bot_active พร้อมกันจะส่ง notice สองครั้งและทับห้องที่ admin claim แทรก
// ตอบ notice เฉพาะผู้ที่ changeMode สำเร็จ (changed: true) คนที่แพ้ race ไม่ตอบซ้ำ
async function routeToStaffWhileBotDisabled(db: DbOrTx, conversationId: string): Promise<LineOutgoingMessage[]> {
  const changed = await changeMode(db, conversationId, 'waiting_handoff');
  if (!changed.ok || !changed.changed) return [];

  const replies: LineOutgoingMessage[] = [{ type: 'text', text: BOT_DISABLED_TEXT }];
  await persistBotReplies(db, conversationId, replies);
  return replies;
}

export async function routeBotMessage(
  db: Db,
  event: LineMessageEvent,
  text: string | null,
  lineUserPk: string,
  conversationId: string,
  now: Date = new Date(),
): Promise<{ replies: LineOutgoingMessage[]; state?: CaseFlowState | null }> {
  // § routeBotMessage เป็น pure decision — ห้ามเขียน botState เอง (เขียนตอน commitEffects เท่านั้น)
  if (!text) {
    if (event.message.type === 'location') {
      const [user] = await db.select().from(lineUsers).where(eq(lineUsers.id, lineUserPk)).limit(1);
      const botState = user?.botState as CaseFlowState | null;
      if (botState?.step === 'location') {
        const loc = event.message;
        const locText = loc.address ?? `${loc.latitude},${loc.longitude}`;
        const result = await processCaseFlow(db, locText, botState, event.source.userId);
        return { replies: result.replies, state: result.state };
      }
    }
    return { replies: [{ type: 'text', text: 'ได้รับแล้วครับ (รองรับข้อความและ location) พิมพ์ "แจ้งเรื่องใหม่" เพื่อเริ่มแจ้งเรื่อง' }] };
  }

  const normalized = text.trim().toLowerCase();

  if (
    normalized.includes('แจ้งเรื่อง') ||
    normalized.includes('ร้องเรียน') ||
    normalized === 'แจ้ง'
  ) {
    const { state, reply } = await startCaseFlow(db);
    return { replies: [reply], state };
  }

  if (normalized.startsWith('ติดตาม')) {
    const code = text.replace(/ติดตาม\s*/i, '').trim().toUpperCase();
    if (code) return { replies: await trackCase(db, code) };
    return { replies: [{ type: 'text', text: 'กรุณาระบุเลขติดตาม เช่น "ติดตาม HG123456789"' }] };
  }

  // § ปุ่ม rich menu "คำถามที่พบบ่อย" ส่งข้อความนี้ — เดิมไม่มี handler ตก
  // fallback "ไม่เข้าใจคำถาม" (audit พบ) จัดการตรงนี้เลยให้ตอบ FAQ ได้จริง
  // § match แบบ exact เท่านั้น — includes('faq') เดิมกว้างเกิน (audit: ข้อความ
  // อื่นที่มี substring โดน short-circuit ข้าม handoff/case-flow recovery)
  if (normalized === COPY.FAQ_LABEL || normalized === 'faq') {
    return { replies: [getFaqReply()] };
  }

  const [user] = await db.select().from(lineUsers).where(eq(lineUsers.id, lineUserPk)).limit(1);
  const botState = user?.botState as CaseFlowState | null;

  if (botState) {
    const result = await processCaseFlow(db, text, botState, event.source.userId);
    return { replies: result.replies, state: result.state };
  }

  const engineV2 = await getChatSetting('bot_engine_v2');
  if (engineV2) {
    const intentResult = await matchIntent(text);
    if (intentResult) {
      return { replies: intentResult.responses };
    }
  }

  const faqResult = await matchFaq(db, text);
  if (faqResult) {
    return { replies: await parseResponseText(faqResult.answer) };
  }

  if (await isHandoffRequest(text)) {
    // § นอกเวลาทำการไม่ย้ายเข้า waiting_handoff — ไม่งั้นบอทจะเงียบทั้งคืน (แม้ผู้ใช้พิมพ์
    // "ติดตาม …") จนเจ้าหน้าที่เข้างาน บอกตรง ๆ ว่านอกเวลาแล้วให้ใช้บริการอัตโนมัติไปก่อน
    const hours = await getChatSetting('business_hours');
    if (!isWithinBusinessHours(hours, now)) {
      return { replies: [{ type: 'text', text: outsideBusinessHoursText(hours) }] };
    }
    return { replies: await triggerHandoff(db, conversationId) };
  }

  return { replies: [{
    type: 'text',
    text: 'ขออภัยครับ ไม่เข้าใจคำถาม\n\nลองพิมพ์:\n• "แจ้งเรื่องใหม่" — แจ้งเรื่อง\n• "ติดตาม HGxxxxxxxxx" — ตรวจสอบสถานะ\n• "ติดต่อเจ้าหน้าที่" — พูดคุยกับเจ้าหน้าที่',
  }] };
}

async function trackCase(db: Db, trackingCode: string): Promise<LineOutgoingMessage[]> {
  // § normalize (เลขที่พิมพ์มีเว้นวรรค เช่น HG 4837 2915 6) + กติกาความยินยอม + audit
  // อยู่ใน citizen-access — เดิมบอทค้นตรงไม่เช็คความยินยอม เรื่องที่เจ้าของถอนแล้ว
  // ยังโชว์หัวเรื่อง+สถานะผ่านแชทได้ ทั้งที่เว็บตอบ 404
  const view = await findTrackableCaseStatus(trackingCode, { channel: 'line_bot' }, db);
  if (!view) {
    return [{ type: 'text', text: `ไม่พบเรื่องเลข ${trackingCode} กรุณาตรวจสอบเลขติดตามอีกครั้ง` }];
  }
  return [caseStatusFlex(view.trackingCode, view.status, view.title)];
}

// § เขียนได้เฉพาะใน transaction ตอน commitEffects — ห้ามเรียกจาก routeBotMessage
async function updateBotState(db: DbOrTx, lineUserPk: string, state: CaseFlowState | null) {
  await db
    .update(lineUsers)
    .set({ botState: state, updatedAt: new Date() })
    .where(eq(lineUsers.id, lineUserPk));
}

async function handleFollowEvent(db: DbOrTx, event: LineFollowEvent, lineUserPk: string, conversationId: string, transport: LineTransport): Promise<LineOutgoingMessage[]> {
  // § บันทึก friend event ก่อน (best-effort) เพื่อให้ {follow_count} รวมครั้งนี้ — พังห้ามล้ม welcome
  await recordFriendEvent(db, lineUserPk, 'follow', event.webhookEventId).catch(() => false);
  const followCount = await getFollowCount(db, lineUserPk).catch(() => null);
  // § โปรไฟล์ดึงแบบ best-effort — พังหรือไม่มียังต้องส่ง welcome ต่อ (display_name ว่าง)
  const profile = await transport.getProfile(event.source.userId).catch(() => null);
  const replies = await getWelcomeMessages({ displayName: profile?.displayName ?? null, followCount });

  // คงพฤติกรรมเดิม: บันทึกแค่ข้อความแรกเป็น text
  await db.insert(chatMessages).values({
    id: generateId(),
    conversationId,
    sender: 'bot',
    messageType: 'text',
    textContent: (replies[0] as { type: 'text'; text: string }).text,
  });

  return replies;
}

async function handlePostbackEvent(db: DbOrTx, event: LinePostbackEvent, conversationId: string): Promise<LineOutgoingMessage[]> {
  await db.insert(chatMessages).values({
    id: generateId(),
    conversationId,
    sender: 'user',
    messageType: 'system',
    textContent: `[postback] ${event.postback.data}`,
    metadata: event.postback.params ?? null,
  });

  // § § barrier-forced message vs postback: ถ้า postback มาก่อน message ที่ยังไม่ commit effects
  // ต้องไม่ record postback (log) ก่อน — commitEffects จะ throw BarrierDeferred และ rollback transaction
  const csatData = parseCsatPostback(event.postback.data);
  if (csatData) {
    // § ให้คะแนนห้องของคนกดเท่านั้น — wire มีแค่ score ห้องใช้ของ session นี้ (ไม่มี id ให้ปลอม)
    // รอบปิดอ่านจากห้องตอนแตะ: reopen แล้วปิดใหม่ถือเป็นรอบใหม่ โหวตได้อีก
    const [conv] = await db
      .select({ resolvedAt: chatConversations.resolvedAt })
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1);
    const recorded = await recordCsatResponse(db, conversationId, csatData.score, conv?.resolvedAt ?? null);
    // § กดซ้ำไม่ตอบขอบคุณซ้ำ — คะแนนแถวแรกชนะแล้ว thank-you มีในประวัติแล้ว
    if (recorded.kind === 'recorded') {
      const thanks: LineOutgoingMessage[] = [{ type: 'text', text: csatThankYou(recorded.score) }];
      await persistBotReplies(db, conversationId, thanks);
      return thanks;
    }
    return [];
  }

  const confirmData = parseConfirmPostback(event.postback.data);
  if (!confirmData) return [];

  const lineUser = await findLineUserByRaw(db, event.source.userId);
  const botState = (lineUser?.botState as CaseFlowState | null) ?? null;
  // § นอก confirm step (เช่น กดปุ่มซ้ำหลังส่งเรื่องแล้ว) คืน null → คง log-only ไม่ตอบซ้ำ
  const result = await handleConfirmPostback(db, confirmData, botState, event.source.userId);
  if (!result) return [];

  if (lineUser) {
    await updateBotState(db, lineUser.id, result.state);
  }
  // § persist-ก่อน-reply เหมือนสาย message — persist อยู่ใน transaction, reply อยู่นอก
  await persistBotReplies(db, conversationId, result.replies);
  return result.replies;
}
