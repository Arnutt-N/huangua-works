import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatBroadcasts } from '@/lib/db/schema';
import { broadcastMessage, getFollowerIds } from './client';
import type { LineOutgoingMessage } from './types';

// § retry ระดับ request (LINE broadcast API ไม่มี per-recipient failed tokens —
// ต่างจาก jsk-app ที่ multicast แล้วเก็บ token ล้มรายตัว): ล้ม retry สูงสุด 3 ครั้ง
// แล้วค่อย mark failed, สำเร็จ mark sent พร้อมนับ estimatedRecipients
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

export async function sendBroadcast(broadcastId: string): Promise<void> {
  const db = await getDb();

  const updated = await db
    .update(chatBroadcasts)
    .set({ status: 'sending', updatedAt: new Date() })
    .where(and(eq(chatBroadcasts.id, broadcastId), eq(chatBroadcasts.status, 'scheduled')))
    .returning({ id: chatBroadcasts.id, content: chatBroadcasts.content });

  const row = updated[0];
  if (!row) {
    const [draft] = await db
      .update(chatBroadcasts)
      .set({ status: 'sending', updatedAt: new Date() })
      .where(and(eq(chatBroadcasts.id, broadcastId), eq(chatBroadcasts.status, 'draft')))
      .returning({ id: chatBroadcasts.id, content: chatBroadcasts.content });
    if (!draft) return;
    await deliverAndRecord(db, draft.id, draft.content as LineOutgoingMessage[]);
    return;
  }

  await deliverAndRecord(db, row.id, row.content as LineOutgoingMessage[]);
}

async function deliverAndRecord(db: Awaited<ReturnType<typeof getDb>>, id: string, messages: LineOutgoingMessage[]) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await broadcastMessage(messages);
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }
    }
  }

  if (lastError === null) {
    await db
      .update(chatBroadcasts)
      .set({
        status: 'sent',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(chatBroadcasts.id, id));
  } else {
    await db
      .update(chatBroadcasts)
      .set({
        status: 'failed',
        errorMessage: lastError instanceof Error ? lastError.message.slice(0, 500) : 'unknown',
        updatedAt: new Date(),
      })
      .where(eq(chatBroadcasts.id, id));
  }
}

/** dry-run: นับ followers โดยไม่ส่งจริง — preview ก่อนกดส่ง */
export async function dryRunBroadcast(): Promise<{ estimatedRecipients: number }> {
  let count = 0;
  let start: string | undefined;
  for (;;) {
    const page = await getFollowerIds(1000, start);
    count += page.userIds.length;
    if (!page.next) break;
    start = page.next;
  }
  return { estimatedRecipients: count };
}

export async function getDueScheduled(): Promise<{ id: string }[]> {
  const db = await getDb();
  return db
    .select({ id: chatBroadcasts.id })
    .from(chatBroadcasts)
    .where(
      and(
        eq(chatBroadcasts.status, 'scheduled'),
        sql`${chatBroadcasts.scheduledAt} <= NOW()`,
      ),
    )
    .orderBy(chatBroadcasts.scheduledAt)
    .limit(5);
}
