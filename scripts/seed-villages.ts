/**
 * Seed script — ข้อมูลหมู่บ้าน จากกรมการปกครอง (catalog.dopa.go.th, Open Data Commons)
 * รันด้วย: npx tsx scripts/seed-villages.ts
 *
 * แหล่งข้อมูล: scripts/geodata/villages.json (trim แล้ว 80,396 หมู่บ้าน, 8.4MB)
 * โครงสร้าง: { villages: [{ mcode, mname, tcode, lat, lon }] }
 *   tcode = subDistrictCode (6 หลัก) ใช้ join กับ sub_districts.sub_district_code
 *
 * Idempotent: ถ้า villages มีข้อมูลอยู่แล้วจะข้าม
 */

import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { getDb, closeDb } from '../src/lib/db';
import { subDistricts, villages } from '../src/lib/db/schema';

config({ path: '.env.local', override: false });

const here = dirname(fileURLToPath(import.meta.url));

interface VillageSrc {
  mcode: string;
  mname: string;
  tcode: string; // first 6 chars = sub_district_code
  lat: string | null;
  lon: string | null;
}

const db = await getDb();

console.log('🏘  Seeding villages (หมู่บ้าน)...\n');

const existing = (await db.select().from(villages).limit(1))[0];
if (existing) {
  console.log('⏭  villages มีข้อมูลอยู่แล้ว — ข้าม\n');
} else {
  const raw = readFileSync(join(here, 'geodata', 'villages.json'), 'utf-8');
  const { villages: villageSrc } = JSON.parse(raw) as { villages: VillageSrc[] };

  // build subDistrictCode → subDistrictId lookup
  const allSubDistricts = await db
    .select({ id: subDistricts.id, subDistrictCode: subDistricts.subDistrictCode })
    .from(subDistricts);
  const codeToId = new Map(allSubDistricts.map((s) => [s.subDistrictCode, s.id]));

  // map villages to insertable rows
  const rows: { subDistrictId: number; code: string; nameTh: string; latitude: string | null; longitude: string | null }[] = [];
  let skipped = 0;
  for (const v of villageSrc) {
    const subDistrictId = codeToId.get(v.tcode);
    if (!subDistrictId) { skipped++; continue; }
    rows.push({
      subDistrictId,
      code: v.mcode,
      nameTh: v.mname,
      latitude: v.lat || null,
      longitude: v.lon || null,
    });
  }

  if (skipped > 0) console.log(`  ⚠ Skipped ${skipped} villages (subdistrict code not found)`);

  // insert in chunks
  const chunkSize = 2000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db.insert(villages).values(rows.slice(i, i + chunkSize));
    if ((i + chunkSize) % 20000 === 0 || i + chunkSize >= rows.length) {
      console.log(`  ✓ ${Math.min(i + chunkSize, rows.length)} / ${rows.length}`);
    }
  }

  console.log(`\n✓ Inserted ${rows.length} villages`);
}

console.log('\n🎉 Village seed completed!\n');
await closeDb();
