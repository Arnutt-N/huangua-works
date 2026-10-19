import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations, chatMessages, lineUsers } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { getChatSetting } from '../settings';

export type SlaBreachKind = 'queue_wait' | 'first_response' | 'resolution';

export interface SlaBreach {
  conversationId: string;
  displayName: string | null;
  kinds: SlaBreachKind[];
  waitingMinutes: number | null;
}

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60000));
}

function waitingSinceOf(metadata: unknown): Date | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as { waitingSince?: unknown }).waitingSince;
  if (typeof raw !== 'string') return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * ห้องที่เกิน SLA ฝั่งแชท — คำนวณจาก timestamp จริง ไม่สร้าง state ใหม่
 * ห้องที่ปิดก่อน feature นี้ (ไม่มี waitingSince) แสดงเป็นไม่มีข้อมูล ไม่ใช่ 0
 */
export async function listSlaBreaches(now: Date = new Date()): Promise<SlaBreach[]> {
  const db = await getDb();
  const sla = await getChatSetting('chat_sla');

  const open = await db
    .select({
      id: chatConversations.id,
      mode: chatConversations.mode,
      displayName: lineUsers.displayName,
      assignedAt: chatConversations.assignedAt,
      metadata: chatConversations.metadata,
    })
    .from(chatConversations)
    .leftJoin(lineUsers, eq(lineUsers.lineUserIdHash, chatConversations.lineUserIdHash))
    .where(and(eq(chatConversations.mode, 'waiting_handoff')));

  const active = await db
    .select({
      id: chatConversations.id,
      displayName: lineUsers.displayName,
      assignedAt: chatConversations.assignedAt,
      createdAt: chatConversations.createdAt,
    })
    .from(chatConversations)
    .leftJoin(lineUsers, eq(lineUsers.lineUserIdHash, chatConversations.lineUserIdHash))
    .where(and(eq(chatConversations.mode, 'human_active')));

  const breaches: SlaBreach[] = [];

  for (const room of open) {
    const since = waitingSinceOf(room.metadata);
    const waitingMinutes = since ? minutesBetween(since, now) : null;
    if (waitingMinutes !== null && waitingMinutes > sla.queueWaitMinutes) {
      breaches.push({ conversationId: room.id, displayName: room.displayName, kinds: ['queue_wait'], waitingMinutes });
    }
  }

  for (const room of active) {
    const kinds: SlaBreachKind[] = [];
    const firstAdmin = await firstOrUndefined(
      db
        .select({ createdAt: chatMessages.createdAt })
        .from(chatMessages)
        .where(and(eq(chatMessages.conversationId, room.id), eq(chatMessages.sender, 'admin')))
        .limit(1),
    );
    // FRT นับจากเวลารับเรื่อง — ยังไม่มีข้อความแอดมินและเกิน threshold ถือว่า breach
    if (!firstAdmin && room.assignedAt && minutesBetween(room.assignedAt, now) > sla.firstResponseMinutes) {
      kinds.push('first_response');
    }
    if (room.assignedAt && minutesBetween(room.assignedAt, now) > sla.resolutionHours * 60) {
      kinds.push('resolution');
    }
    if (kinds.length > 0) {
      breaches.push({ conversationId: room.id, displayName: room.displayName, kinds, waitingMinutes: null });
    }
  }

  return breaches;
}
