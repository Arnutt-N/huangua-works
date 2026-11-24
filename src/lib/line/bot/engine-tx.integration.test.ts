import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import {
  cases,
  categories,
  chatConversations,
  chatCsatResponses,
  chatFaq,
  chatMessages,
  lineFriendEvents,
  lineUsers,
} from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { pseudonymizeLineId } from '../identity';
import { matchFaq } from './faq-matcher';
import { changeMode } from '../conversation/mode-service';
import { recordCsatResponse } from '../chat/csat';
import { recordFriendEvent } from '../friend-events';
import { processCaseFlow, type CaseFlowState } from './case-flow';
import { createRecordingTransport } from '../conversation/recording-transport';
import type { LineWebhookEvent } from '../types';
import { runEventEffects } from './engine';

// § ต้องมี docker compose up -d postgres redis up-redis + .env.local ก่อนรัน
vi.setConfig({ testTimeout: 30_000 });

const RUN = Date.now();
const RAW_USER_ID = `U-tx-${RUN}`;
const USER_HASH = pseudonymizeLineId(RAW_USER_ID).hash;
const LINE_MESSAGE_ID = `msg-tx-${RUN}-1`;
const CATEGORY_ID = `cat-tx-${RUN}`;
const FAQ_ID = `faq-tx-${RUN}`;
const CONV_ID = `conv-tx-${RUN}`;
const CSAT_CONV_ID = `conv-csat-tx-${RUN}`;
let seq = 0;
function messageEvent(): LineWebhookEvent {
  seq++;
  return {
    type: 'message',
    replyToken: `reply-tx-${RUN}-${seq}`,
    timestamp: RUN + seq,
    mode: 'active',
    webhookEventId: `webhook-tx-${RUN}-${seq}`,
    source: { type: 'user', userId: RAW_USER_ID },
    message: { type: 'text', id: `msg-tx-${RUN}-${seq}`, text: 'สวัสดี' },
  } as LineWebhookEvent;
}

afterAll(async () => {
  const db = await getDb();
  await db.delete(chatMessages).where(eq(chatMessages.lineMessageId, LINE_MESSAGE_ID));
  await db.delete(lineFriendEvents).where(eq(lineFriendEvents.webhookEventId, `evt-tx-${RUN}`));
  await db.delete(chatCsatResponses).where(eq(chatCsatResponses.conversationId, CSAT_CONV_ID));
  await db.delete(cases).where(eq(cases.title, `case-tx-${RUN}`));
  await db.delete(chatConversations).where(inArray(chatConversations.id, [CONV_ID, CSAT_CONV_ID]));
  await db.delete(lineUsers).where(eq(lineUsers.lineUserIdHash, USER_HASH));
  await db.delete(chatFaq).where(eq(chatFaq.id, FAQ_ID));
  await db.delete(categories).where(eq(categories.id, CATEGORY_ID));
  await closeDb();
});

describe('issue #229 · effects transaction boundary', () => {
  test('rollback ของ effects transaction ต้องไม่ทิ้ง chat_messages ไว้', async () => {
    const db = await getDb();
    const event = messageEvent();

    await expect(db.transaction(async (tx) => {
      await runEventEffects(tx, event, createRecordingTransport());
      throw new Error('effects failed');
    })).rejects.toThrow('effects failed');

    const leaked = await db.select({ id: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.lineMessageId, LINE_MESSAGE_ID));
    expect(leaked).toHaveLength(0);
  });

  test('rollback ต้องคืน mode เดิมของห้อง', async () => {
    const db = await getDb();
    await db.insert(lineUsers).values({
      id: generateId(),
      lineUserIdHash: USER_HASH,
      lineUserIdEnc: 'enc-tx',
      lineUserIdHashV: 1,
    }).onConflictDoNothing();
    await db.insert(chatConversations).values({ id: CONV_ID, lineUserIdHash: USER_HASH, mode: 'bot_active' });

    await expect(db.transaction(async (tx) => {
      const changed = await changeMode(tx, CONV_ID, 'waiting_handoff');
      expect(changed).toEqual({ ok: true, changed: true });
      throw new Error('effects failed');
    })).rejects.toThrow('effects failed');

    const [conv] = await db.select({ mode: chatConversations.mode }).from(chatConversations)
      .where(eq(chatConversations.id, CONV_ID)).limit(1);
    expect(conv?.mode).toBe('bot_active');
  });

  test('rollback ต้องไม่ทิ้งคำตอบ CSAT', async () => {
    const db = await getDb();
    const resolvedAt = new Date(RUN);
    await db.insert(chatConversations).values({
      id: CSAT_CONV_ID,
      lineUserIdHash: pseudonymizeLineId(`it-csat-tx-${RUN}`).hash,
      mode: 'resolved',
      resolvedAt,
    });
    // § FK ไป line_users — ต้องมีแถวรองรับก่อน(recordCsatResponse ไม่สร้าง user เอง)
    await db.insert(lineUsers).values({
      id: generateId(),
      lineUserIdHash: pseudonymizeLineId(`it-csat-tx-${RUN}`).hash,
      lineUserIdEnc: 'enc-csat-tx',
      lineUserIdHashV: 1,
    }).onConflictDoNothing();

    await expect(db.transaction(async (tx) => {
      const recorded = await recordCsatResponse(tx, CSAT_CONV_ID, 5, resolvedAt);
      expect(recorded).toEqual({ kind: 'recorded', score: 5 });
      throw new Error('effects failed');
    })).rejects.toThrow('effects failed');

    const rows = await db.select({ id: chatCsatResponses.id }).from(chatCsatResponses)
      .where(eq(chatCsatResponses.conversationId, CSAT_CONV_ID));
    expect(rows).toHaveLength(0);
  });

  test('rollback ต้องคืน hitCount ของ FAQ', async () => {
    const db = await getDb();
    await db.insert(chatFaq).values({
      id: FAQ_ID,
      question: `faq-tx-${RUN}`,
      answer: 'ตอบ',
      keywords: [`tx${RUN}`],
      hitCount: 0,
    });

    await expect(db.transaction(async (tx) => {
      const match = await matchFaq(tx, `tx${RUN}`);
      expect(match?.id).toBe(FAQ_ID);
      throw new Error('effects failed');
    })).rejects.toThrow('effects failed');

    const [faq] = await db.select({ hitCount: chatFaq.hitCount }).from(chatFaq)
      .where(eq(chatFaq.id, FAQ_ID)).limit(1);
    expect(faq?.hitCount).toBe(0);
  });

  test('rollback ต้องไม่ทิ้ง follow event', async () => {
    const db = await getDb();
    const [user] = await db.select({ id: lineUsers.id }).from(lineUsers)
      .where(eq(lineUsers.lineUserIdHash, USER_HASH)).limit(1);

    await expect(db.transaction(async (tx) => {
      const inserted = await recordFriendEvent(tx, user!.id, 'follow', `evt-tx-${RUN}`);
      expect(inserted).toBe(true);
      throw new Error('effects failed');
    })).rejects.toThrow('effects failed');

    const rows = await db.select({ id: lineFriendEvents.id }).from(lineFriendEvents)
      .where(eq(lineFriendEvents.webhookEventId, `evt-tx-${RUN}`));
    expect(rows).toHaveLength(0);
  });

  test('rollback ต้องไม่ทิ้งเรื่องที่แจ้งผ่าน case flow', async () => {
    const db = await getDb();
    await db.insert(categories).values({
      id: CATEGORY_ID,
      name: `tx-${RUN}`,
      slug: `tx-${RUN}`,
      isActive: true,
    });

    const state: CaseFlowState = {
      step: 'confirm',
      categoryId: CATEGORY_ID,
      categoryName: `tx-${RUN}`,
      title: `case-tx-${RUN}`,
      description: 'รายละเอียดสำหรับทดสอบ rollback',
      location: 'หัวงัว',
    };
    await expect(db.transaction(async (tx) => {
      const result = await processCaseFlow(tx, 'ยืนยัน', state, RAW_USER_ID);
      expect(result.state).toBeNull();
      throw new Error('effects failed');
    })).rejects.toThrow('effects failed');

    const rows = await db.select({ id: cases.id }).from(cases)
      .where(eq(cases.title, `case-tx-${RUN}`));
    expect(rows).toHaveLength(0);
  });
});
