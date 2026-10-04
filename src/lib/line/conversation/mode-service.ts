import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb, type Db } from '@/lib/db';
import { chatConversations } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import type { ConversationMode } from '../chat-modes';
import { broadcast } from '../sse/broadcaster';
import { allowedSourceModes } from './modes';

export type ModeChangeResult =
  | { ok: true; changed: boolean }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'conflict'; currentMode: ConversationMode };

export interface ChangeModeOptions {
  /** แอดมินที่สั่ง — บังคับเมื่อ to = human_active (กลายเป็นเจ้าของห้อง) */
  actorAdminId?: string;
  /** ผูกเคสไปพร้อมกันใน UPDATE เดียว (PATCH ส่ง mode + linkedCaseId มาพร้อมกันได้) */
  linkedCaseId?: string | null;
}

export interface TransferInput {
  toAdminId: string;
  byAdminId: string;
  reason?: string;
}

export type LinkCaseResult = { ok: true } | { ok: false; reason: 'not_found' };

async function findModeRow(db: Db, conversationId: string) {
  return firstOrUndefined(
    db
      .select({ mode: chatConversations.mode, assignedAdminId: chatConversations.assignedAdminId })
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1),
  );
}

function buildModeUpdates(to: ConversationMode, opts: ChangeModeOptions, now: Date) {
  return {
    mode: to,
    updatedAt: now,
    ...(to === 'human_active' ? { assignedAdminId: opts.actorAdminId, assignedAt: now } : {}),
    ...(to === 'resolved' ? { resolvedAt: now } : {}),
    ...(opts.linkedCaseId !== undefined ? { linkedCaseId: opts.linkedCaseId } : {}),
  } satisfies Partial<typeof chatConversations.$inferInsert>;
}

/**
 * เปลี่ยนโหมดบทสนทนา — ทางเดียวที่ควรใช้เปลี่ยน chat_conversations.mode
 *
 * § guard อยู่ใน WHERE (atomic) — สองแอดมินกดรับพร้อมกัน คนหลังได้ conflict ไม่ทับเงียบ ๆ
 * § broadcast mode_change ทุกครั้งที่เปลี่ยนจริง — เดิม handoff ลืม broadcast ทำ inbox ค้าง
 */
export async function changeMode(
  conversationId: string,
  to: ConversationMode,
  opts: ChangeModeOptions = {},
): Promise<ModeChangeResult> {
  if (to === 'human_active' && !opts.actorAdminId) {
    throw new Error('changeMode(human_active) ต้องระบุ actorAdminId');
  }

  const db = await getDb();
  const [updated] = await db
    .update(chatConversations)
    .set(buildModeUpdates(to, opts, new Date()))
    .where(and(eq(chatConversations.id, conversationId), inArray(chatConversations.mode, allowedSourceModes(to))))
    .returning({ id: chatConversations.id });

  if (updated) {
    broadcast({
      type: 'mode_change',
      conversationId,
      payload: {
        mode: to,
        ...(to === 'human_active' ? { assignedAdminId: opts.actorAdminId } : {}),
        ...(opts.linkedCaseId !== undefined ? { linkedCaseId: opts.linkedCaseId } : {}),
      },
    });
    return { ok: true, changed: true };
  }

  const existing = await findModeRow(db, conversationId);
  if (!existing) return { ok: false, reason: 'not_found' };

  // idempotent: อยู่ในโหมดปลายทางแล้ว — human_active ต้องเป็นเจ้าของคนเดิมเท่านั้น
  const alreadyThere =
    existing.mode === to && (to !== 'human_active' || existing.assignedAdminId === opts.actorAdminId);
  if (!alreadyThere) return { ok: false, reason: 'conflict', currentMode: existing.mode };

  // § idempotent = ไม่ update — ผูกเคสต้องไปทาง linkCase แยก ไม่ทำซ้ำใน path นี้
  return { ok: true, changed: false };
}

/** โอนห้องที่เจ้าหน้าที่ดูแลอยู่ให้เจ้าหน้าที่อื่น — ผู้เรียกต้องตรวจว่าปลายทางเป็น staff ที่ active เอง */
export async function transferOwnership(
  conversationId: string,
  input: TransferInput,
): Promise<ModeChangeResult> {
  const db = await getDb();
  const now = new Date();
  const transferAudit = {
    toAdminId: input.toAdminId,
    byAdminId: input.byAdminId,
    at: now.toISOString(),
    ...(input.reason ? { reason: input.reason } : {}),
  };

  const [transferred] = await db
    .update(chatConversations)
    .set({
      assignedAdminId: input.toAdminId,
      assignedAt: now,
      updatedAt: now,
      metadata: sql`jsonb_set(
        coalesce(${chatConversations.metadata}, '{}'::jsonb),
        '{transfers}',
        coalesce(${chatConversations.metadata} -> 'transfers', '[]'::jsonb) || ${JSON.stringify(transferAudit)}::jsonb
      )`,
    })
    // atomic guard: โอนได้เฉพาะห้องที่เจ้าหน้าที่กำลังดูแลอยู่จริง
    .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.mode, 'human_active')))
    .returning({ id: chatConversations.id });

  if (transferred) {
    broadcast({
      type: 'mode_change',
      conversationId,
      payload: { mode: 'human_active', assignedAdminId: input.toAdminId },
    });
    return { ok: true, changed: true };
  }

  const existing = await findModeRow(db, conversationId);
  if (!existing) return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'conflict', currentMode: existing.mode };
}

/** ผูก/ปลดเคสกับบทสนทนาโดยไม่เปลี่ยนโหมด */
export async function linkCase(conversationId: string, linkedCaseId: string | null): Promise<LinkCaseResult> {
  const db = await getDb();
  const [linked] = await db
    .update(chatConversations)
    .set({ linkedCaseId, updatedAt: new Date() })
    .where(eq(chatConversations.id, conversationId))
    .returning({ id: chatConversations.id });

  if (!linked) return { ok: false, reason: 'not_found' };

  // § คงชนิด mode_change ตาม PATCH เดิม — client refetch inbox เหมือนกันทั้งสองชนิด
  broadcast({ type: 'mode_change', conversationId, payload: { linkedCaseId } });
  return { ok: true };
}
