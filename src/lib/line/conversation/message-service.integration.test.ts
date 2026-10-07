import { asc, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatConversations, chatMessages } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type { ConversationMode } from '../chat-modes';

vi.mock('../sse/broadcaster', () => ({ broadcast: vi.fn() }));

import { broadcast } from '../sse/broadcaster';
import { recordBotReplies, recordInboundMessage, sendAdminReply } from './message-service';
import { createRecordingTransport } from './recording-transport';

const created: string[] = [];

async function createConv(mode: ConversationMode, unreadAdmin = 0): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.insert(chatConversations).values({ id, lineUserId: `it-msg-${id}`, mode, unreadAdmin });
  created.push(id);
  return id;
}

async function loadConv(id: string) {
  const db = await getDb();
  const [conv] = await db.select().from(chatConversations).where(eq(chatConversations.id, id));
  if (!conv) throw new Error('conversation หายจาก DB ระหว่างเทสต์');
  return conv;
}

async function loadMessages(conversationId: string) {
  const db = await getDb();
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(asc(chatMessages.id));
}

beforeEach(() => {
  vi.mocked(broadcast).mockClear();
});

afterAll(async () => {
  const db = await getDb();
  if (created.length > 0) {
    await db.delete(chatMessages).where(inArray(chatMessages.conversationId, created));
    await db.delete(chatConversations).where(inArray(chatConversations.id, created));
  }
  await closeDb();
});

describe('recordInboundMessage', () => {
  test('bot_active: บันทึกข้อความ + last message + unread=0 + broadcast new_message แล้ว conversation_update', async () => {
    const id = await createConv('bot_active', 3);

    const { messageId } = await recordInboundMessage({
      conversationId: id,
      mode: 'bot_active',
      messageType: 'text',
      textContent: 'ถนนหน้าบ้านพัง',
      locationData: null,
      lineMessageId: 'line-msg-1',
    });

    const [msg] = await loadMessages(id);
    expect(msg).toMatchObject({ id: messageId, sender: 'user', messageType: 'text', textContent: 'ถนนหน้าบ้านพัง', lineMessageId: 'line-msg-1' });
    const conv = await loadConv(id);
    expect(conv.lastMessageText).toBe('ถนนหน้าบ้านพัง');
    expect(conv.lastMessageSender).toBe('user');
    expect(conv.unreadAdmin).toBe(0);

    const calls = vi.mocked(broadcast).mock.calls.map(([e]) => e);
    expect(calls.map((e) => e.type)).toEqual(['new_message', 'conversation_update']);
    expect(calls[0]).toMatchObject({ conversationId: id, payload: { id: messageId, sender: 'user', textContent: 'ถนนหน้าบ้านพัง' } });
    expect(calls[1]).toEqual({ type: 'conversation_update', conversationId: id, payload: { lastMessageText: 'ถนนหน้าบ้านพัง' } });
  });

  test('human_active: นับ unreadAdmin เพิ่ม', async () => {
    const id = await createConv('human_active', 2);
    await recordInboundMessage({
      conversationId: id,
      mode: 'human_active',
      messageType: 'text',
      textContent: 'ยังรออยู่ครับ',
      locationData: null,
      lineMessageId: 'line-msg-2',
    });
    expect((await loadConv(id)).unreadAdmin).toBe(3);
  });

  test('§ countUnread: true บังคับนับ unread แม้ห้องเป็น bot_active (engine ส่งมาตอน bot_enabled=false)', async () => {
    const id = await createConv('bot_active', 5);
    await recordInboundMessage({
      conversationId: id,
      mode: 'bot_active',
      messageType: 'text',
      textContent: 'บอทปิดอยู่ใช่ไหม',
      locationData: null,
      lineMessageId: 'line-msg-c5',
      countUnread: true,
    });
    expect((await loadConv(id)).unreadAdmin).toBe(6);
  });

  test('ข้อความไม่มี text (location) ใช้ "[location]" เป็นข้อความล่าสุด + เก็บ locationData', async () => {
    const id = await createConv('bot_active');
    const locationData = { title: 'บ้าน', address: 'หัวงัว', latitude: 16.4, longitude: 103.3 };
    await recordInboundMessage({
      conversationId: id,
      mode: 'bot_active',
      messageType: 'location',
      textContent: null,
      locationData,
      lineMessageId: 'line-msg-3',
    });
    expect((await loadConv(id)).lastMessageText).toBe('[location]');
    expect((await loadMessages(id))[0]!.locationData).toEqual(locationData);
  });
});

describe('recordBotReplies', () => {
  test('บันทึกทุกคำตอบเป็น sender=bot เรียงตามลำดับ; flex เก็บ flexPayload; ไม่ broadcast', async () => {
    const id = await createConv('bot_active');
    await recordBotReplies(id, [
      { type: 'flex', altText: 'กำลังเชื่อมต่อ', contents: { type: 'bubble' } },
      { type: 'text', text: 'ระบบได้แจ้งเจ้าหน้าที่แล้วครับ' },
    ]);

    const rows = await loadMessages(id);
    expect(rows.map((r) => [r.sender, r.messageType])).toEqual([
      ['bot', 'flex'],
      ['bot', 'text'],
    ]);
    expect(rows[0]!.flexPayload).toEqual({ type: 'bubble' });
    expect(rows[1]!.textContent).toBe('ระบบได้แจ้งเจ้าหน้าที่แล้วครับ');
    expect(broadcast).not.toHaveBeenCalled();
  });

  test('ไม่มีคำตอบ → ไม่ insert อะไร', async () => {
    const id = await createConv('bot_active');
    await recordBotReplies(id, []);
    expect(await loadMessages(id)).toHaveLength(0);
  });
});

describe('sendAdminReply', () => {
  const ADMIN = generateId();

  test('ส่งใหม่: push ผ่าน transport + pushStatus=sent + last message เป็น admin + broadcast new_message', async () => {
    const id = await createConv('human_active', 4);
    const transport = createRecordingTransport();

    const result = await sendAdminReply({ conversationId: id, adminUserId: ADMIN, text: 'รับเรื่องแล้วครับ', clientTempId: `t-${id}` }, transport);

    expect(result).toMatchObject({ kind: 'sent', pushStatus: 'sent' });
    expect(transport.calls).toEqual([
      { kind: 'push', to: `it-msg-${id}`, messages: [{ type: 'text', text: 'รับเรื่องแล้วครับ' }] },
    ]);
    const [row] = await loadMessages(id);
    expect(row).toMatchObject({ sender: 'admin', adminUserId: ADMIN, textContent: 'รับเรื่องแล้วครับ', metadata: { pushStatus: 'sent' } });
    const conv = await loadConv(id);
    expect(conv.lastMessageSender).toBe('admin');
    expect(conv.unreadAdmin).toBe(0);
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'new_message', conversationId: id, payload: expect.objectContaining({ sender: 'admin', clientTempId: `t-${id}` }) }),
    );
  });

  test('retry ด้วย clientTempId เดิมหลังสำเร็จ → duplicate ไม่ push ซ้ำ ไม่สร้างแถวใหม่', async () => {
    const id = await createConv('human_active');
    const transport = createRecordingTransport();
    const input = { conversationId: id, adminUserId: ADMIN, text: 'ซ้ำ', clientTempId: `t-${id}` };

    const first = await sendAdminReply(input, transport);
    const second = await sendAdminReply(input, transport);

    expect(second).toEqual({ kind: 'duplicate', messageId: (first as { messageId: string }).messageId, pushStatus: 'sent' });
    expect(transport.calls.filter((c) => c.kind === 'push')).toHaveLength(1);
    expect(await loadMessages(id)).toHaveLength(1);
  });

  test('push ล้ม → push_failed ไม่ broadcast; retry ด้วย tempId เดิม push ใหม่สำเร็จ → duplicate pushStatus=sent', async () => {
    const id = await createConv('human_active');
    const transport = createRecordingTransport();
    const input = { conversationId: id, adminUserId: ADMIN, text: 'ลองใหม่', clientTempId: `t-${id}` };

    transport.failNextPush();
    const failed = await sendAdminReply(input, transport);
    expect(failed).toMatchObject({ kind: 'push_failed' });
    expect(broadcast).not.toHaveBeenCalled();
    expect((await loadMessages(id))[0]!.metadata).toEqual({ pushStatus: 'failed' });

    const retried = await sendAdminReply(input, transport);
    expect(retried).toEqual({ kind: 'duplicate', messageId: (failed as { messageId: string }).messageId, pushStatus: 'sent' });
    expect(transport.calls.filter((c) => c.kind === 'push')).toHaveLength(2);
    expect(await loadMessages(id)).toHaveLength(1);
  });

  test('ไม่มี clientTempId → ส่งได้ตามปกติ', async () => {
    const id = await createConv('human_active');
    const result = await sendAdminReply({ conversationId: id, adminUserId: ADMIN, text: 'ไม่มี tempId' }, createRecordingTransport());
    expect(result).toMatchObject({ kind: 'sent' });
  });

  test('ห้องที่ไม่มีอยู่ → not_found และไม่แตะ LINE', async () => {
    const transport = createRecordingTransport();
    expect(await sendAdminReply({ conversationId: generateId(), adminUserId: ADMIN, text: 'x' }, transport)).toEqual({ kind: 'not_found' });
    expect(transport.calls).toHaveLength(0);
  });
});
