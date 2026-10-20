/**
 * Purge script (one-shot, H3) — เปลี่ยน users.email เก่า `line-<raw>@placeholder.local`
 * เป็น `line-<hmac>@placeholder.local` ให้ตรงกับ placeholder ใหม่ (step 5)
 *
 * หา raw จาก enc ใน line_users ผ่าน linked_user_id แล้วคำนวณ HMAC ด้วย LINE_ID_HMAC_KEY
 * อัปเดตเฉพาะแถวที่ localPart ไม่ใช่ hex 64 ตัว (ของใหม่ข้าม)
 *
 * รันด้วย: npx tsx scripts/purge-line-plaintext-emails.ts [--apply]
 *   ไม่มี --apply = dry-run (แสดงผลอย่างเดียว ไม่เขียน DB)
 */

import { config } from 'dotenv';
import { eq, like } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { lineUsers, users } from '../src/lib/db/schema';
import { decryptLineId, lookupHash } from '../src/lib/line/identity';
import { linePlaceholderEmail } from '../src/lib/line/placeholder-email';

config({ path: '.env.local', override: false });

const apply = process.argv.includes('--apply');
const isHashHex = (s: string) => /^[0-9a-f]{64}$/.test(s);

const db = await getDb();

console.log(
  `🧹 Purge plaintext LINE emails — ${apply ? 'APPLY' : 'DRY-RUN (ส่ง --apply เพื่อเขียนจริง)'}\n`
);

const candidates = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(like(users.email, 'line-%@placeholder.local'));

const rows = await db
  .select({ linkedUserId: lineUsers.linkedUserId, enc: lineUsers.lineUserIdEnc })
  .from(lineUsers);

const encByUser = new Map<string, string>();
for (const r of rows) {
  if (r.linkedUserId && r.enc) encByUser.set(r.linkedUserId, r.enc);
}

let purged = 0;
let skipped = 0;
for (const u of candidates) {
  const local = u.email.slice('line-'.length, u.email.length - '@placeholder.local'.length);
  if (isHashHex(local)) {
    skipped++;
    continue;
  }
  const enc = encByUser.get(u.id);
  if (!enc) {
    console.log(`  ! ${u.email} — ไม่มี line_users link ข้าม (ต้องจัดการมือ)`);
    continue;
  }
  const raw = decryptLineId(enc);
  const next = linePlaceholderEmail(lookupHash(raw));
  console.log(`  ${apply ? '✓' : '·'} ${u.email} → ${next}`);
  if (apply) {
    await db.update(users).set({ email: next }).where(eq(users.id, u.id));
    purged++;
  }
}

console.log(
  `\nสรุป: placeholder ${candidates.length} ราย — ${apply ? `purge ${purged}` : 'dry-run ไม่ได้เขียน DB'}, ของใหม่ข้าม ${skipped}`
);

await closeDb();
