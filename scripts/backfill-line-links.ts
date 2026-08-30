/**
 * Backfill script — เติม line_users.linked_user_id ให้ผู้ใช้เก่าที่แจ้งผ่านบอท
 * ก่อนระบบ LIFF เขียน link อัตโนมัติตอน login (ตาม docs/prp-liff-mobile.md §T2)
 *
 * users.email รูปแบบ `line-<lineUserId>@placeholder.local` (จาก resolveSubmitter
 * ใน src/lib/cases/intake.ts) — parse lineUserId จาก local part แล้วจับคู่กับ
 * line_users.line_user_id
 *
 * Idempotent + ไม่ overwrite — เติมเฉพาะแถวที่ linked_user_id ยังเป็น NULL
 * รันด้วย: npx tsx scripts/backfill-line-links.ts [--apply]
 *   ไม่มี --apply = dry-run (แสดงผลอย่างเดียว ไม่เขียน DB)
 */

import { config } from 'dotenv';
import { eq, like } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { lineUserIdFromPlaceholderEmail } from '../src/lib/line/placeholder-email';
import { lineUsers, users } from '../src/lib/db/schema';

config({ path: '.env.local', override: false });

const apply = process.argv.includes('--apply');

const db = await getDb();

console.log(
  `🔗 Backfill line_users.linked_user_id — ${apply ? 'APPLY' : 'DRY-RUN (ส่ง --apply เพื่อเขียนจริง)'}\n`
);

const placeholderUsers = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(like(users.email, 'line-%@placeholder.local'));

const lineRows = await db
  .select({
    id: lineUsers.id,
    lineUserId: lineUsers.lineUserId,
    linkedUserId: lineUsers.linkedUserId,
  })
  .from(lineUsers);
const lineRowsByLineId = new Map(lineRows.map((row) => [row.lineUserId, row]));

let linked = 0;
let alreadyLinked = 0;
let noLineRow = 0;

for (const user of placeholderUsers) {
  const lineUserId = lineUserIdFromPlaceholderEmail(user.email);
  if (!lineUserId) {
    noLineRow += 1;
    continue;
  }
  const lineRow = lineRowsByLineId.get(lineUserId);
  if (!lineRow) {
    // § เช่น email จาก intake ที่ไม่รู้ lineUserId (`line-<generateId()>@...`) — ไม่มีแถวให้จับคู่
    noLineRow += 1;
    continue;
  }
  if (lineRow.linkedUserId) {
    alreadyLinked += 1;
    continue;
  }
  linked += 1;
  console.log(`  ✓ ${user.email} → users ${user.id} (line_users ${lineRow.id})`);
  if (apply) {
    await db
      .update(lineUsers)
      .set({ linkedUserId: user.id, updatedAt: new Date() })
      .where(eq(lineUsers.id, lineRow.id));
  }
}

console.log(
  `\nสรุป: placeholder users ${placeholderUsers.length} ราย — ผูกใหม่ ${linked}, ` +
    `มี link อยู่แล้ว ${alreadyLinked}, ไม่มีแถว line_users ให้จับคู่ ${noLineRow}` +
    (apply ? ' — เขียน DB แล้ว' : ' — dry-run ไม่ได้เขียน DB')
);

await closeDb();
