/**
 * Backfill — เติม storage_key ให้แถวที่มี URL เต็มอยู่แล้ว
 * (แถวก่อน migration 0035 เก็บ `${S3_ENDPOINT}/${bucket}/${key}` ไม่มีคอลัมน์ key)
 *
 * § ทำไม: T3 จะอ่านไฟล์ผ่าน presigned URL ซึ่งต้องได้ key ก่อน ถ้าแถวเก่าไม่มี key
 * ไฟล์ที่ประชาชนส่งมาก่อน deploy จะเปิดไม่ได้เลย — url เดิมยังอยู่เป็น fallback
 * แต่ keyFromUrl ต้องทำงานกับแถวนั้นได้ จึงเติมล่วงหน้า
 *
 * เลือกเฉพาะแถวที่ storage_key IS NULL และคอลัมน์ url ยังมีค่า
 *   - media_files.url         (ไฟล์ที่แอดมินอัปโหลด)
 *   - chat_messages.media_url (สำเนาของไฟล์ที่ประชาชนส่งผ่าน LINE)
 * แถวที่ keyFromUrl คืน null (URL ไม่ใช่ของ storage เรา หรือ S3_ENDPOINT ไม่ตรง) = ข้าม
 * และนับแยก เพื่อให้เห็นว่ามีแถวที่ presigned read จะเปิดไม่ได้
 *
 * idempotent: กรอง storage_key IS NULL จึงรันซ้ำได้ ไม่ทับค่าที่มีแล้ว
 *
 * รันด้วย: npx tsx scripts/backfill-media-storage-key.ts [--apply] [--verbose]
 *   ไม่มี --apply = dry-run (อ่านอย่างเดียว)
 *   --verbose = พิมพ์รายแถวที่ข้าม
 */

import { config } from 'dotenv';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { chatMessages, mediaFiles } from '../src/lib/db/schema';
import { keyFromUrl } from '../src/lib/storage';

config({ path: '.env.local', override: false });

const apply = process.argv.includes('--apply');
const verbose = process.argv.includes('--verbose');

interface TablePlan {
  label: string;
  rows: { id: string; url: string | null }[];
  write: (id: string, key: string) => Promise<void>;
}

async function main() {
  const db = await getDb();

  const mediaRows = await db
    .select({ id: mediaFiles.id, url: mediaFiles.url })
    .from(mediaFiles)
    .where(and(isNull(mediaFiles.storageKey), isNotNull(mediaFiles.url)));

  const chatRows = await db
    .select({ id: chatMessages.id, url: chatMessages.mediaUrl })
    .from(chatMessages)
    .where(and(isNull(chatMessages.storageKey), isNotNull(chatMessages.mediaUrl)));

  const plans: TablePlan[] = [
    {
      label: 'media_files',
      rows: mediaRows,
      write: async (id, key) => {
        await db.update(mediaFiles).set({ storageKey: key }).where(eq(mediaFiles.id, id));
      },
    },
    {
      label: 'chat_messages',
      rows: chatRows,
      write: async (id, key) => {
        await db.update(chatMessages).set({ storageKey: key }).where(eq(chatMessages.id, id));
      },
    },
  ];

  let totalWritten = 0;
  let totalSkipped = 0;

  for (const plan of plans) {
    let written = 0;
    const skipped: { id: string; url: string }[] = [];

    for (const row of plan.rows) {
      const key = row.url ? keyFromUrl(row.url) : null;
      if (!key) {
        if (row.url) skipped.push({ id: row.id, url: row.url });
        continue;
      }
      if (apply) await plan.write(row.id, key);
      written++;
    }

    totalWritten += written;
    totalSkipped += skipped.length;

    console.log(
      `${plan.label}: ${plan.rows.length} แถวรอเติม — ${apply ? 'เขียน' : 'จะเขียน'} ${written}` +
        (skipped.length ? ` · ข้าม ${skipped.length} (URL ไม่ตรงรูปแบบ storage)` : ''),
    );

    if (verbose) {
      for (const s of skipped.slice(0, 20)) console.log(`  ✗ ${s.id}  ${s.url}`);
      if (skipped.length > 20) console.log(`  … อีก ${skipped.length - 20} แถว`);
    }
  }

  console.log(
    `\nสรุป: ${apply ? 'เขียนจริง' : 'dry-run จะเขียน'} ${totalWritten} แถว` +
      (totalSkipped ? ` · ข้าม ${totalSkipped} แถวที่ presigned read จะเปิดไม่ได้` : '') +
      (apply ? '' : ' — ไม่ได้เขียน DB'),
  );

  if (totalSkipped > 0 && !apply) {
    console.log('รันซ้ำด้วย --verbose เพื่อดูรายการที่ข้าม');
  }

  await closeDb();
}

await main();
