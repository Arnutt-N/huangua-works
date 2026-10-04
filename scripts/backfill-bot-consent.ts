/**
 * Backfill — บันทึกความยินยอม data_collection ให้ผู้แจ้งผ่านบอท LINE รุ่นเก่า
 * (แจ้งก่อน createCase เริ่มบันทึก consent via line_bot_submit — refactor/citizen-case-access)
 *
 * § ทำไมต้องมี: citizen-access ใช้กติกาเดียวทุกช่องทาง — "record data_collection ล่าสุด
 * ต้องเป็นการให้ความยินยอม" ไม่มี record เลย = มองไม่เห็นเรื่อง ผู้แจ้งผ่านบอทรุ่นเก่าไม่มี
 * record จึงหายจากทั้งเว็บ / บอท / เรื่องของฉัน จนกว่าจะรัน script นี้ด้วย --apply
 *
 * เลือกเฉพาะ users ที่:
 *   - email รูปแบบ placeholder สาย LINE (`line-%@placeholder.local`, ดู src/lib/line/placeholder-email.ts)
 *   - เป็นเจ้าของเรื่องอย่างน้อย 1 เรื่อง
 *   - ไม่มี consent_records data_collection เลยสักแถว
 * (คนที่เคยถอน = มีแถว revoke → ไม่แตะ / คนที่แจ้งผ่าน LIFF = มีแถว grant อยู่แล้ว)
 *
 * ไม่ concurrent-idempotent: NOT EXISTS ไม่ serialize กับ intake/withdraw ที่เริ่มก่อน commit
 * สอง backfill หรือ backfill ที่ชน grant/revoke อาจผ่าน NOT EXISTS ทั้งคู่ แล้ว insert grant
 * ด้วย now() ทำให้ consent ล่าสุดกลับเป็น granted ทั้งที่เพิ่งถอน
 * ข้อกำหนด: รัน --apply ใน maintenance window ที่ไม่มี intake/withdraw (ประกาศในขั้น deploy)
 * แล้วรัน query ตรวจผลหลัง apply — รันซ้ำตอนไม่มี writer พร้อมกันได้ (แถวที่มี record แล้วถูกตัด)
 *
 * รันด้วย: npx tsx scripts/backfill-bot-consent.ts [--apply] [--verbose]
 *   ไม่มี --apply = dry-run (แสดงผลอย่างเดียว ไม่เขียน DB)
 *   --verbose = พิมพ์รายแถว (default เงียบ — email ฝัง LINE userId)
 * § ลำดับ deploy: รัน --apply ทันทีหลัง deploy โค้ด citizen-access (รันก่อน deploy ไม่พอ —
 *   เรื่องที่แจ้งผ่านบอทระหว่างนั้นยังไม่มี consent)
 */

import { config } from 'dotenv';
import { and, eq, exists, like, notExists, sql } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { cases, consentRecords, users } from '../src/lib/db/schema';
import { CONSENT_VERSION } from '../src/lib/consent';
import { generateId } from '../src/lib/id';

config({ path: '.env.local', override: false });

const apply = process.argv.includes('--apply');
const verbose = process.argv.includes('--verbose');

const BACKFILL_METADATA = {
  via: 'backfill_bot_intake',
  basis: 'แจ้งเรื่องผ่านแชทบอท LINE ก่อนมีการบันทึกความยินยอมอัตโนมัติ',
};

const db = await getDb();

console.log(
  `🔏 Backfill ความยินยอมของผู้แจ้งผ่านบอท — ${apply ? 'APPLY' : 'DRY-RUN (ส่ง --apply เพื่อเขียนจริง)'}${verbose ? ' (verbose)' : ''}\n`
);

const candidates = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(
    and(
      like(users.email, 'line-%@placeholder.local'),
      exists(db.select({ id: cases.id }).from(cases).where(eq(cases.submittedBy, users.id))),
      notExists(
        db
          .select({ id: consentRecords.id })
          .from(consentRecords)
          .where(and(eq(consentRecords.userId, users.id), eq(consentRecords.consentType, 'data_collection'))),
      ),
    ),
  );

if (verbose) {
  for (const user of candidates) console.log(`  ✓ users ${user.id} (${user.email})`);
}

let writtenCount = 0;
if (apply && candidates.length > 0) {
  // § NOT EXISTS กันแถวซ้ำเมื่อรันซ้ำตอนไม่มี writer อื่น — ไม่กัน concurrent intake/withdraw
  // ต้องรัน --apply ใน maintenance window (ดูหัวไฟล์) แล้วตรวจด้วย query ใน Step 4
  // § postgres protocol จำกัด 65,535 params/statement (2 ต่อแถว ≈ 32k แถว) — ถ้ามากกว่านั้นให้ chunk ก่อน
  const result = await db.execute(sql`
    INSERT INTO consent_records (id, user_id, consent_type, version, is_granted, granted_at, metadata)
    SELECT v.id, v.user_id, 'data_collection', ${CONSENT_VERSION}, true, now(), ${JSON.stringify(BACKFILL_METADATA)}::jsonb
    FROM (VALUES ${sql.join(
      candidates.map((user) => sql`(${generateId()}::text, ${user.id}::text)`),
      sql`, `
    )}) AS v(id, user_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM consent_records c
      WHERE c.user_id = v.user_id AND c.consent_type = 'data_collection'
    )
    RETURNING id
  `);
  // postgres-js คืน RowList เป็น Array ตรง ๆ — length = จำนวนแถวที่เขียนจริง
  writtenCount = (result as unknown[]).length;
}

console.log(
  `\nสรุป: ผู้แจ้งผ่านบอทที่ยังไม่มีบันทึกความยินยอม ${candidates.length} ราย` +
    (apply ? ` — เขียนจริง ${writtenCount} แถว` : ' — dry-run ไม่ได้เขียน DB')
);

await closeDb();
