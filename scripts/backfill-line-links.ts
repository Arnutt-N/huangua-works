/**
 * Backfill script — เติม line_users.linked_user_id ให้ผู้ใช้เก่าที่แจ้งผ่านบอท
 * ก่อนระบบ LIFF เขียน link อัตโนมัติตอน login (ตาม docs/prp-liff-mobile.md §T2)
 *
 * users.email รูปแบบ `line-<localPart>@placeholder.local` (contract เดียวกับ
 * src/lib/line/placeholder-email.ts) — parse lineUserId แล้วจับคู่กับ
 * line_users.line_user_id ผ่าน unique index (lookup เฉพาะชุดที่ parse ได้ ไม่ดึงทั้งตาราง)
 *
 * Idempotent + ไม่ overwrite — เติมเฉพาะแถวที่ linked_user_id ยังเป็น NULL
 * (UPDATE แบบ batch ครั้งเดียว + เงื่อนไข IS NULL คุม invariant แม้มีเขียนชนะระหว่างรัน)
 *
 * รันด้วย: npx tsx scripts/backfill-line-links.ts [--apply] [--verbose]
 *   ไม่มี --apply = dry-run (แสดงผลอย่างเดียว ไม่เขียน DB)
 *   --verbose = พิมพ์รายแถวที่จะผูก (default เงียบ แสดงแค่สรุป — email ฝัง LINE userId)
 */

import { config } from 'dotenv';
import { inArray, like, sql } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { lineUserIdFromPlaceholderEmail } from '../src/lib/line/placeholder-email';
import { lineUsers, users } from '../src/lib/db/schema';

config({ path: '.env.local', override: false });

const apply = process.argv.includes('--apply');
const verbose = process.argv.includes('--verbose');

const db = await getDb();

console.log(
  `🔗 Backfill line_users.linked_user_id — ${apply ? 'APPLY' : 'DRY-RUN (ส่ง --apply เพื่อเขียนจริง)'}${verbose ? ' (verbose)' : ''}\n`
);

const placeholderUsers = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(like(users.email, 'line-%@placeholder.local'));

// § lookup เฉพาะ lineUserId ที่ parse ออกมา (inArray บน unique index) — ไม่ดึง line_users ทั้งตาราง
const derivedIds = placeholderUsers
  .map((user) => lineUserIdFromPlaceholderEmail(user.email))
  .filter((id): id is string => id !== null && id !== '');
const lineRowsByLineId = new Map<string, { id: string; linkedUserId: string | null }>();
if (derivedIds.length > 0) {
  const lineRows = await db
    .select({
      id: lineUsers.id,
      lineUserId: lineUsers.lineUserId,
      linkedUserId: lineUsers.linkedUserId,
    })
    .from(lineUsers)
    .where(inArray(lineUsers.lineUserId, derivedIds));
  for (const row of lineRows) lineRowsByLineId.set(row.lineUserId, row);
}

let alreadyLinked = 0;
let noLineRow = 0;
let writtenCount = 0;
const toFill: { lineRowId: string; lineUserId: string; userId: string }[] = [];

for (const user of placeholderUsers) {
  const lineUserId = lineUserIdFromPlaceholderEmail(user.email);
  if (lineUserId === null) {
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
  toFill.push({ lineRowId: lineRow.id, lineUserId, userId: user.id });
  if (verbose) console.log(`  ✓ ${user.email} → users ${user.id} (line_users ${lineRow.id})`);
}

if (apply && toFill.length > 0) {
  // § เงื่อนไข linked_user_id IS NULL ใน statement คุม invariant "ไม่ overwrite"
  // แม้มีอีก process เขียน link ชนะระหว่างที่ script กำลังรัน — RETURNING นับแถวที่เขียนจริง
  // § postgres protocol จำกัด 65,535 params/statement (3 ต่อแถว ≈ 21k แถว) — ถ้าต้อง
  // backfill ปริมาณมาก ให้ chunk toFill ก่อนยิง
  const result = await db.execute(
    sql`UPDATE line_users AS l SET linked_user_id = v.uid, updated_at = now() FROM (VALUES ${sql.join(
      toFill.map((row) => sql`(${row.lineUserId}::text, ${row.userId}::text, ${row.lineRowId}::text)`),
      sql`, `
    )}) AS v(line_user_id, uid, line_row_id) WHERE l.id = v.line_row_id AND l.line_user_id = v.line_user_id AND l.linked_user_id IS NULL RETURNING l.id`
  );
  // postgres-js คืน RowList เป็น Array ตรง ๆ (probe แล้ว) — length = จำนวนแถวที่เขียนจริง
  writtenCount = (result as unknown[]).length;
}

console.log(
  `\nสรุป: placeholder users ${placeholderUsers.length} ราย — ผูกใหม่ ${toFill.length}` +
    (apply ? ` (เขียนจริง ${writtenCount})` : '') +
    `, มี link อยู่แล้ว ${alreadyLinked}, ไม่มีแถว line_users ให้จับคู่ ${noLineRow}` +
    (apply ? ' — เขียน DB แล้ว' : ' — dry-run ไม่ได้เขียน DB')
);

await closeDb();
