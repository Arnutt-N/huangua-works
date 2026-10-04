import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatConversations } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type { ConversationMode } from '../chat-modes';

vi.mock('../sse/broadcaster', () => ({ broadcast: vi.fn() }));

import { broadcast } from '../sse/broadcaster';
import { changeMode, linkCase, transferOwnership } from './mode-service';

const ADMIN_A = generateId();
const ADMIN_B = generateId();
const created: string[] = [];

async function createConv(mode: ConversationMode, assignedAdminId: string | null = null): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.insert(chatConversations).values({ id, lineUserId: `it-mode-${id}`, mode, assignedAdminId });
  created.push(id);
  return id;
}

async function loadConv(id: string) {
  const db = await getDb();
  const [conv] = await db.select().from(chatConversations).where(eq(chatConversations.id, id));
  if (!conv) throw new Error('conversation หายจาก DB ระหว่างเทสต์');
  return conv;
}

beforeEach(() => {
  vi.mocked(broadcast).mockClear();
});

afterAll(async () => {
  const db = await getDb();
  if (created.length > 0) {
    await db.delete(chatConversations).where(inArray(chatConversations.id, created));
  }
  await closeDb();
});

describe('changeMode', () => {
  test('claim: bot_active → human_active ตั้งเจ้าของห้อง + broadcast mode_change', async () => {
    const id = await createConv('bot_active');

    const result = await changeMode(id, 'human_active', { actorAdminId: ADMIN_A });

    expect(result).toEqual({ ok: true, changed: true });
    const conv = await loadConv(id);
    expect(conv.mode).toBe('human_active');
    expect(conv.assignedAdminId).toBe(ADMIN_A);
    expect(conv.assignedAt).toBeInstanceOf(Date);
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: id,
      payload: { mode: 'human_active', assignedAdminId: ADMIN_A },
    });
  });

  test('claim ซ้อน: แอดมินอื่นได้ conflict; เจ้าของเดิมได้ idempotent และไม่ broadcast', async () => {
    const id = await createConv('human_active', ADMIN_A);

    expect(await changeMode(id, 'human_active', { actorAdminId: ADMIN_B })).toEqual({
      ok: false,
      reason: 'conflict',
      currentMode: 'human_active',
    });
    expect(await changeMode(id, 'human_active', { actorAdminId: ADMIN_A })).toEqual({
      ok: true,
      changed: false,
    });
    expect(broadcast).not.toHaveBeenCalled();
    expect((await loadConv(id)).assignedAdminId).toBe(ADMIN_A);
  });

  test('handoff: bot_active → waiting_handoff broadcast payload มีแค่ mode', async () => {
    const id = await createConv('bot_active');

    expect(await changeMode(id, 'waiting_handoff')).toEqual({ ok: true, changed: true });
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: id,
      payload: { mode: 'waiting_handoff' },
    });
  });

  test('resolved → waiting_handoff ได้ (ผู้ใช้ทักห้องที่ปิดแล้วขอคุยกับเจ้าหน้าที่)', async () => {
    const id = await createConv('resolved');
    expect(await changeMode(id, 'waiting_handoff')).toEqual({ ok: true, changed: true });
    expect((await loadConv(id)).mode).toBe('waiting_handoff');
  });

  test('human_active → resolved ตั้ง resolvedAt', async () => {
    const id = await createConv('human_active', ADMIN_A);
    expect(await changeMode(id, 'resolved')).toEqual({ ok: true, changed: true });
    const conv = await loadConv(id);
    expect(conv.mode).toBe('resolved');
    expect(conv.resolvedAt).toBeInstanceOf(Date);
  });

  test('§ resolved → human_active เป็น conflict — ตรงกับ claim guard เดิม', async () => {
    const id = await createConv('resolved');
    expect(await changeMode(id, 'human_active', { actorAdminId: ADMIN_A })).toEqual({
      ok: false,
      reason: 'conflict',
      currentMode: 'resolved',
    });
    expect((await loadConv(id)).mode).toBe('resolved');
  });

  test('เปลี่ยนเป็นโหมดเดิม (bot_active → bot_active) idempotent ไม่ broadcast', async () => {
    const id = await createConv('bot_active');
    expect(await changeMode(id, 'bot_active')).toEqual({ ok: true, changed: false });
    expect(broadcast).not.toHaveBeenCalled();
  });

  test('linkedCaseId ไปพร้อม mode ใน UPDATE เดียว', async () => {
    const id = await createConv('human_active', ADMIN_A);
    const caseId = generateId();

    expect(await changeMode(id, 'resolved', { linkedCaseId: caseId })).toEqual({ ok: true, changed: true });
    expect((await loadConv(id)).linkedCaseId).toBe(caseId);
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: id,
      payload: { mode: 'resolved', linkedCaseId: caseId },
    });
  });

  test('ห้องที่ไม่มีอยู่ → not_found', async () => {
    expect(await changeMode(generateId(), 'resolved')).toEqual({ ok: false, reason: 'not_found' });
  });

  test('human_active โดยไม่ระบุ actorAdminId → throw (bug ของผู้เรียก ไม่ใช่ input ผู้ใช้)', async () => {
    const id = await createConv('bot_active');
    await expect(changeMode(id, 'human_active')).rejects.toThrow('actorAdminId');
  });
});

describe('transferOwnership', () => {
  test('โอนห้อง human_active + ต่อท้าย metadata.transfers + broadcast', async () => {
    const id = await createConv('human_active', ADMIN_A);

    const result = await transferOwnership(id, { toAdminId: ADMIN_B, byAdminId: ADMIN_A, reason: 'ทดสอบโอนเวร' });

    expect(result).toEqual({ ok: true, changed: true });
    const conv = await loadConv(id);
    expect(conv.assignedAdminId).toBe(ADMIN_B);
    const transfers = (conv.metadata as { transfers?: unknown[] } | null)?.transfers;
    expect(transfers).toHaveLength(1);
    expect(transfers?.[0]).toMatchObject({ toAdminId: ADMIN_B, byAdminId: ADMIN_A, reason: 'ทดสอบโอนเวร' });
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: id,
      payload: { mode: 'human_active', assignedAdminId: ADMIN_B },
    });
  });

  test('ห้องที่ไม่ใช่ human_active → conflict', async () => {
    const id = await createConv('resolved');
    expect(await transferOwnership(id, { toAdminId: ADMIN_B, byAdminId: ADMIN_A })).toEqual({
      ok: false,
      reason: 'conflict',
      currentMode: 'resolved',
    });
    expect(broadcast).not.toHaveBeenCalled();
  });

  test('ห้องที่ไม่มีอยู่ → not_found', async () => {
    expect(await transferOwnership(generateId(), { toAdminId: ADMIN_B, byAdminId: ADMIN_A })).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
});

describe('linkCase', () => {
  test('ผูก/ปลดเคสโดยไม่เปลี่ยนโหมด + broadcast', async () => {
    const id = await createConv('bot_active');
    const caseId = generateId();

    expect(await linkCase(id, caseId)).toEqual({ ok: true });
    expect((await loadConv(id)).linkedCaseId).toBe(caseId);
    expect((await loadConv(id)).mode).toBe('bot_active');
    expect(broadcast).toHaveBeenCalledWith({
      type: 'mode_change',
      conversationId: id,
      payload: { linkedCaseId: caseId },
    });

    expect(await linkCase(id, null)).toEqual({ ok: true });
    expect((await loadConv(id)).linkedCaseId).toBeNull();
  });

  test('ห้องที่ไม่มีอยู่ → not_found', async () => {
    expect(await linkCase(generateId(), null)).toEqual({ ok: false, reason: 'not_found' });
  });
});
