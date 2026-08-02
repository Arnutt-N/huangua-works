import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatBroadcasts } from '@/lib/db/schema';
import { broadcastMessage } from './client';
import type { LineOutgoingMessage } from './types';

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
  try {
    await broadcastMessage(messages);

    await db
      .update(chatBroadcasts)
      .set({
        status: 'sent',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(chatBroadcasts.id, id));
  } catch (err) {
    await db
      .update(chatBroadcasts)
      .set({
        status: 'failed',
        errorMessage: err instanceof Error ? err.message.slice(0, 500) : 'unknown',
        updatedAt: new Date(),
      })
      .where(eq(chatBroadcasts.id, id));
  }
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
