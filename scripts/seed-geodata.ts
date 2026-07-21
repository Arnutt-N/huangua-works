/**
 * Seed script — ข้อมูลภูมิศาสตร์ (จังหวัด/อำเภอ/ตำบล) จาก thailand-geodata (MIT)
 * รันด้วย: pnpm tsx scripts/seed-geodata.ts
 *
 * แหล่งข้อมูล: scripts/geodata/*.json (vendor ไว้จาก Dhanabhon/thailand-geodata)
 *   provinces 77 · districts 928 · sub_districts 7,436
 * ⚠️ ไม่มีระดับหมู่บ้าน — dataset หยุดที่ตำบล (หมู่บ้านเก็บเป็น free-text ใน cases.village)
 *
 * Idempotent: ถ้า provinces มีข้อมูลอยู่แล้วจะข้าม (กัน insert ซ้ำตอนรันซ้ำ)
 */

import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PgTable } from 'drizzle-orm/pg-core';
import { getDb, closeDb } from '../src/lib/db';
import { provinces, districts, subDistricts } from '../src/lib/db/schema';

config({ path: '.env.local', override: false });

const here = dirname(fileURLToPath(import.meta.url));
const geodataDir = join(here, 'geodata');

interface ProvinceSrc {
  PROVINCE_ID: number;
  CODE: string;
  PROVINCE_THAI: string;
  PROVINCE_ENGLISH: string;
}
interface DistrictSrc {
  DISTRICT_ID: number;
  PROVINCE_ID: number;
  CODE: string;
  DISTRICT_CODE: string;
  DISTRICT_THAI: string;
  DISTRICT_ENGLISH: string;
}
interface SubDistrictSrc {
  SUB_DISTRICT_ID: number;
  DISTRICT_ID: number;
  CODE: string;
  SUB_DISTRICT_CODE: string;
  SUB_DISTRICT_THAI: string;
  SUB_DISTRICT_ENGLISH: string;
  LATITUDE: string | null;
  LONGITUDE: string | null;
  POSTAL_CODE: string | null;
}

function loadJson<T>(filename: string, key: string): T[] {
  const raw = readFileSync(join(geodataDir, filename), 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, T[]>;
  return parsed[key];
}

/** แยก insert เป็นชุดๆ กัน query ใหญ่เกินไป (sub_districts ~7.4k แถว) */
async function insertInChunks(
  table: PgTable,
  rows: Record<string, unknown>[],
  chunkSize = 1000,
): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db.insert(table).values(rows.slice(i, i + chunkSize) as never[]);
  }
}

const db = await getDb();

console.log('🗺  Seeding geography (จังหวัด/อำเภอ/ตำบล)...\n');

const existing = (await db.select().from(provinces).limit(1))[0];
if (existing) {
  console.log('⏭  provinces มีข้อมูลอยู่แล้ว — ข้าม (ลบตารางแล้วรันใหม่ถ้าต้องการ reseed)\n');
} else {
  const provinceSrc = loadJson<ProvinceSrc>('provinces.json', 'provinces');
  const districtSrc = loadJson<DistrictSrc>('districts.json', 'districts');
  const subDistrictSrc = loadJson<SubDistrictSrc>('sub_districts.json', 'sub_districts');

  await insertInChunks(
    provinces,
    provinceSrc.map((p) => ({
      id: p.PROVINCE_ID,
      code: p.CODE,
      nameTh: p.PROVINCE_THAI,
      nameEn: p.PROVINCE_ENGLISH,
    })),
  );
  console.log(`✓ Inserted ${provinceSrc.length} provinces`);

  await insertInChunks(
    districts,
    districtSrc.map((d) => ({
      id: d.DISTRICT_ID,
      provinceId: d.PROVINCE_ID,
      code: d.CODE,
      districtCode: d.DISTRICT_CODE,
      nameTh: d.DISTRICT_THAI,
      nameEn: d.DISTRICT_ENGLISH,
    })),
  );
  console.log(`✓ Inserted ${districtSrc.length} districts`);

  await insertInChunks(
    subDistricts,
    subDistrictSrc.map((s) => ({
      id: s.SUB_DISTRICT_ID,
      districtId: s.DISTRICT_ID,
      code: s.CODE,
      subDistrictCode: s.SUB_DISTRICT_CODE,
      nameTh: s.SUB_DISTRICT_THAI,
      nameEn: s.SUB_DISTRICT_ENGLISH,
      postalCode: s.POSTAL_CODE,
      latitude: s.LATITUDE,
      longitude: s.LONGITUDE,
    })),
  );
  console.log(`✓ Inserted ${subDistrictSrc.length} sub-districts`);
}

console.log('\n🎉 Geography seed completed!\n');
await closeDb();
