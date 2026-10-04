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

  return [
    handoffNotifyFlex(),
    { type: 'text', text: 'ระบบได้แจ้งเจ้าหน้าที่แล้วครับ กรุณารอสักครู่' },
  ];
}
