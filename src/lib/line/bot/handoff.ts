import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations } from '@/lib/db/schema';
import type { LineOutgoingMessage } from '../types';
import { handoffNotifyFlex } from '../messages/flex';
import { getChatSetting } from '../settings';
import { changeMode } from '../conversation';

export async function isHandoffRequest(text: string): Promise<boolean> {
  const keywords = await getChatSetting('handoff_keywords');
  const normalized = text.toLowerCase().trim();
  return keywords.some((kw) => normalized.includes(kw.toLowerCase()));
}

export async function triggerHandoff(conversationId: string): Promise<LineOutgoingMessage[]> {
  // § atomic + broadcast อยู่ใน changeMode — changeMode คืน conflict ก็ยังต้องตอบ flex
  // ตามเดิม (ผู้ใช้ขอคุยกับเจ้าหน้าที่ ต้องได้คำตอบเสมอ)
  await changeMode(conversationId, 'waiting_handoff');

  // § ตำแหน่งคิว = จำนวนห้อง waiting ที่มาก่อน (เรียง updatedAt) + ตัวเอง
  // นับหลัง changeMode ตัวเองจึงอยู่ในคิวแล้ว — ถ้านับล้มให้ตอบแบบเดิม (fail-open)
  let queueText = 'ระบบได้แจ้งเจ้าหน้าที่แล้วครับ กรุณารอสักครู่';
  try {
    const position = await waitingPosition(conversationId);
    queueText = `ระบบได้แจ้งเจ้าหน้าที่แล้วครับ คุณอยู่ในคิวที่ ${position} กรุณารอสักครู่`;
  } catch {
    console.warn('[line-handoff] queue count unavailable — reply without position');
  }

  return [handoffNotifyFlex(), { type: 'text', text: queueText }];
}

async function waitingPosition(conversationId: string): Promise<number> {
  const db = await getDb();
  const waiting = await db
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(eq(chatConversations.mode, 'waiting_handoff'))
    .orderBy(asc(chatConversations.updatedAt));
  const index = waiting.findIndex((row) => row.id === conversationId);
  return index === -1 ? waiting.length + 1 : index + 1;
}
