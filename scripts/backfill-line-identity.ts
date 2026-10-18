/**
 * Backfill script — เติม line_users.line_user_id_hash/enc ให้แถวเก่าที่ยังไม่มี (T5 backfill)
 *
 * อ่าน raw line_user_id ทีละชุด คำนวณ pseudonym ผ่าน src/lib/line/identity.ts
 * แล้ว UPDATE เฉพาะแถวที่ line_user_id_hash ยังเป็น NULL (idempotent + ไม่ overwrite)
 *
 * รันด้วย: npx tsx scripts/backfill-line-identity.ts [--apply]
 *   ไม่มี --apply = dry-run (แสดงผลอย่างเดียว ไม่เขียน DB)
 *
 * หยุดและรายงานเมื่อเจอแถวที่แปลงไม่ได้ — ไม่ข้ามเงียบ
 */

import { config } from 'dotenv';
import { isNull, sql } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { lineUsers } from '../src/lib/db/schema';
import { pseudonymizeLineId, LINE_ID_HASH_VERSION } from '../src/lib/line/identity';

config({ path: '.env.local', override: false });

const apply = process.argv.includes('--apply');
const BATCH_SIZE = 500;

const db = await getDb();

console.log(
  `🔑 Backfill line_users pseudonym — ${apply ? 'APPLY' : 'DRY-RUN (ส่ง --apply เพื่อเขียนจริง)'}\n`
);

const totalRows = await db
  .select({ id: lineUsers.id })
  .from(lineUsers);
const pendingRows = await db
  .select({ id: lineUsers.id, lineUserId: lineUsers.lineUserId })
  .from(lineUsers)
  .where(isNull(lineUsers.lineUserIdHash));

console.log(`ทั้งหมด ${totalRows.length} แถว — รอเติม ${pendingRows.length} แถว`);

let written = 0;
let failed = 0;
const failures: string[] = [];

for (let i = 0; i < pendingRows.length; i += BATCH_SIZE) {
  const batch = pendingRows.slice(i, i + BATCH_SIZE);
  const values = batch.map((row) => {
    const p = pseudonymizeLineId(row.lineUserId);
    return { id: row.id, hash: p.hash, enc: p.enc, v: p.v };
  });

  if (!apply) continue;

  // § เติมเฉพาะแถวที่ hash ยังว่าง — IS NULL คุม invariant แม้มีเขียนชนะระหว่างรัน
  const result = await db.execute(
    sql`UPDATE line_users AS l SET line_user_id_hash = v.hash, line_user_id_enc = v.enc, line_user_id_hash_v = v.v, updated_at = now() FROM (VALUES ${sql.join(
      values.map((row) => sql`(${row.id}::text, ${row.hash}::text, ${row.enc}::text, ${row.v}::int)`),
      sql`, `
    )}) AS v(id, hash, enc, v) WHERE l.id = v.id AND l.line_user_id_hash IS NULL RETURNING l.id`
  );
  written += (result as unknown[]).length;
}

if (!apply) {
  // § dry-run ต้องพิสูจน์ว่าแปลงได้ทุกแถวก่อน apply จริง — พังตรงไหนรายงานตรงนั้น
  for (const row of pendingRows) {
    try {
      pseudonymizeLineId(row.lineUserId);
    } catch (err) {
      failed += 1;
      failures.push(`${row.id}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
}

console.log(
  `\nสรุป: รอเติม ${pendingRows.length} แถว` +
    (apply ? ` — เขียนจริง ${written} แถว` : ` — แปลงได้ ${pendingRows.length - failed} แปลงไม่ได้ ${failed}`) +
    (apply ? ' — เขียน DB แล้ว' : ' — dry-run ไม่ได้เขียน DB')
);
if (failures.length > 0) {
  console.log('แถวที่แปลงไม่ได้:');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exitCode = 1;
}

// § ตรวจจำนวนครบก่อนจบ — เหลือแถวว่างหลัง apply คือสัญญาณว่ามีเขียนชนหรือข้อมูลผิด
if (apply) {
  const remaining = await db
    .select({ id: lineUsers.id })
    .from(lineUsers)
    .where(isNull(lineUsers.lineUserIdHash));
  console.log(`เหลือยังไม่เติมหลัง apply: ${remaining.length} แถว`);
  if (remaining.length > 0) process.exitCode = 1;
}

await closeDb();

void LINE_ID_HASH_VERSION;
