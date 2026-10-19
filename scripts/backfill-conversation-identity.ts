/**
 * Backfill script — เติม chat_conversations.line_user_id_hash จาก line_users (T5 step 6)
 *
 * join ด้วย plaintext เดิมครั้งสุดท้าย แล้ว UPDATE เฉพาะแถวที่ hash ยังว่าง
 * (idempotent + ไม่ overwrite — รันซ้ำได้)
 *
 * รันด้วย: npx tsx scripts/backfill-conversation-identity.ts [--apply]
 *   ไม่มี --apply = dry-run (แสดงผลอย่างเดียว ไม่เขียน DB)
 */

import { config } from 'dotenv';
import { isNull, sql } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { chatConversations } from '../src/lib/db/schema';

config({ path: '.env.local', override: false });

const apply = process.argv.includes('--apply');

const db = await getDb();

console.log(
  `💬 Backfill chat_conversations hash — ${apply ? 'APPLY' : 'DRY-RUN (ส่ง --apply เพื่อเขียนจริง)'}\n`
);

const pending = await db
  .select({ id: chatConversations.id })
  .from(chatConversations)
  .where(isNull(chatConversations.lineUserIdHash));

console.log(`รอเติม ${pending.length} แถว`);

let written = 0;
if (apply && pending.length > 0) {
  // § เติม hash จาก line_users ผ่าน join plaintext ครั้งสุดท้าย — IS NULL คุม invariant
  const result = await db.execute(
    sql`UPDATE chat_conversations AS c SET line_user_id_hash = l.line_user_id_hash, updated_at = now() FROM line_users AS l WHERE c.line_user_id = l.line_user_id AND c.line_user_id_hash IS NULL AND l.line_user_id_hash IS NOT NULL RETURNING c.id`
  );
  written = (result as unknown[]).length;
}

console.log(
  `\nสรุป: รอเติม ${pending.length} แถว` +
    (apply ? ` — เขียนจริง ${written} แถว` : ' — dry-run ไม่ได้เขียน DB') +
    (apply ? ' — เขียน DB แล้ว' : '')
);

if (apply) {
  const remaining = await db
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(isNull(chatConversations.lineUserIdHash));
  console.log(`เหลือยังไม่เติมหลัง apply: ${remaining.length} แถว`);
  if (remaining.length > 0) process.exitCode = 1;
}

await closeDb();
