/**
 * Rekey script (one-shot, H1) — เขียน line_users.line_user_id_enc ใหม่ด้วย IV สุ่ม
 * หลังแก้ pseudonymizeLineId จาก IV คงที่ (SHA256) เป็น randomBytes(12)
 *
 * ถอด enc เก่าด้วย key เดิม แล้วเข้ารหัสใหม่ — hash ไม่เปลี่ยน lookup ไม่กระทบ
 * (idempotent: รันซ้ำได้ แถวที่ enc ใหม่แล้วถอด-เขียนใหม่ได้ค่าเท่าเดิมทาง semantics)
 *
 * รันด้วย: npx tsx scripts/rekey-line-enc.ts [--apply]
 *   ไม่มี --apply = dry-run (แสดงผลอย่างเดียว ไม่เขียน DB)
 */

import { config } from 'dotenv';
import { closeDb, getDb } from '../src/lib/db';
import { lineUsers } from '../src/lib/db/schema';
import { decryptLineId, lookupHash, pseudonymizeLineId } from '../src/lib/line/identity';

config({ path: '.env.local', override: false });

const apply = process.argv.includes('--apply');

const db = await getDb();

console.log(
  `🔑 Rekey LINE enc (IV สุ่ม) — ${apply ? 'APPLY' : 'DRY-RUN (ส่ง --apply เพื่อเขียนจริง)'}\n`
);

const rows = await db
  .select({ id: lineUsers.id, enc: lineUsers.lineUserIdEnc, v: lineUsers.lineUserIdHashV })
  .from(lineUsers);

let rewritten = 0;
let failed = 0;
for (const r of rows) {
  try {
    const raw = decryptLineId(r.enc);
    // § sanity: hash ของ raw ต้องตรงกับแถว (กัน key ผิดทั้งตาราง)
    const expectHash = lookupHash(raw);
    const [check] = await db
      .select({ id: lineUsers.id })
      .from(lineUsers)
      .where((await import('drizzle-orm')).eq(lineUsers.lineUserIdHash, expectHash))
      .limit(1);
    if (!check || check.id !== r.id) {
      console.log(`  ! ${r.id} — hash ไม่ตรง ข้าม (key อาจผิด)`);
      failed++;
      continue;
    }
    const next = pseudonymizeLineId(raw);
    if (apply) {
      await db.update(lineUsers).set({ lineUserIdEnc: next.enc }).where((await import('drizzle-orm')).eq(lineUsers.id, r.id));
    }
    rewritten++;
  } catch (e) {
    console.log(`  ! ${r.id} — ถอด enc ไม่ได้ ข้าม: ${(e as Error).message}`);
    failed++;
  }
}

console.log(
  `\nสรุป: ทั้งหมด ${rows.length} แถว — ${apply ? `เขียนใหม่ ${rewritten}` : 'dry-run ไม่ได้เขียน DB'}, ล้มเหลว ${failed}`
);
if (failed > 0) process.exitCode = 1;

await closeDb();
