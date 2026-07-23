import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations } from '@/lib/db/schema';
import type { LineOutgoingMessage } from '../types';
import { handoffNotifyFlex } from '../messages/flex';

const HANDOFF_KEYWORDS = ['ติดต่อเจ้าหน้าที่', 'เจ้าหน้าที่', 'คุยกับคน', 'พบเจ้าหน้าที่', 'handoff', 'operator', 'admin'];

export function isHandoffRequest(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return HANDOFF_KEYWORDS.some((kw) => normalized.includes(kw));
}

export async function triggerHandoff(conversationId: string): Promise<LineOutgoingMessage[]> {
  const db = await getDb();

  await db
    .update(chatConversations)
    .set({ mode: 'waiting_handoff', updatedAt: new Date() })
    .where(eq(chatConversations.id, conversationId));

  return [
    handoffNotifyFlex(),
    { type: 'text', text: 'ระบบได้แจ้งเจ้าหน้าที่แล้วครับ กรุณารอสักครู่' },
  ];
}
