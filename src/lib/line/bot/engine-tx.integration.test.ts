import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatMessages } from '@/lib/db/schema';
import { createRecordingTransport } from '../conversation/recording-transport';
import type { LineWebhookEvent } from '../types';
import { runEventEffects } from './engine';

// § ต้องมี docker compose up -d postgres redis up-redis + .env.local ก่อนรัน
vi.setConfig({ testTimeout: 30_000 });

const RUN = Date.now();
let seq = 0;
function messageEvent(): LineWebhookEvent {
  seq++;
  return {
    type: 'message',
    replyToken: `reply-tx-${RUN}-${seq}`,
    timestamp: RUN + seq,
    mode: 'active',
    webhookEventId: `webhook-tx-${RUN}-${seq}`,
    source: { type: 'user', userId: `U-tx-${RUN}` },
    message: { type: 'text', id: `msg-tx-${RUN}-${seq}`, text: 'สวัสดี' },
  } as LineWebhookEvent;
}

afterAll(async () => {
  const db = await getDb();
  await db.delete(chatMessages).where(eq(chatMessages.lineMessageId, `msg-tx-${RUN}-1`));
  await closeDb();
});

describe('issue #229 · effects transaction boundary', () => {
  test('rollback ของ effects transaction ต้องไม่ทิ้ง chat_messages ไว้', async () => {
    const db = await getDb();
    const event = messageEvent();
    const lineMessageId = (event.message as { id: string }).id;

    await expect(db.transaction(async (tx) => {
      await runEventEffects(tx, event, createRecordingTransport());
      throw new Error('effects failed');
    })).rejects.toThrow('effects failed');

    const leaked = await db.select({ id: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.lineMessageId, lineMessageId));
    expect(leaked).toHaveLength(0);
  });
});
