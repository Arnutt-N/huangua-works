import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations } from '@/lib/db/schema';
import type { LineOutgoingMessage } from '../types';
import { handoffNotifyFlex } from '../messages/flex';
import { getChatSetting } from '../settings';
import { broadcast } from '../sse/broadcaster';

export async function isHandoffRequest(text: string): Promise<boolean> {
  const keywords = await getChatSetting('handoff_keywords');
  const normalized = text.toLowerCase().trim();
  return keywords.some((kw) => normalized.includes(kw.toLowerCase()));
}

export async function triggerHandoff(conversationId: string): Promise<LineOutgoingMessage[]> {
  const db = await getDb();

  await db
    .update(chatConversations)
    .set({ mode: 'waiting_handoff', updatedAt: new Date() })
    .where(eq(chatConversations.id, conversationId));

  // § ต้อง broadcast เอง — engine ส่ง conversation_update ไปก่อน route ถึง handoff
  // ถ้าไม่ส่ง mode_change ตรงนี้ inbox แอดมินจะค้างโหมด bot_active
  broadcast({ type: 'mode_change', conversationId, payload: { mode: 'waiting_handoff' } });

  return [
    handoffNotifyFlex(),
    { type: 'text', text: 'ระบบได้แจ้งเจ้าหน้าที่แล้วครับ กรุณารอสักครู่' },
  ];
}
