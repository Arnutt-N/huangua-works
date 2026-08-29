import { expect, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../../src/lib/db';
import { firstOrUndefined } from '../../src/lib/db/query-helpers';
import { districts, provinces, subDistricts, villages } from '../../src/lib/db/schema';

/** ชื่อไทยของ geography หนึ่งชุด ที่ใช้กรอก cascade บนฟอร์ม intake */
export interface Geography {
  province: string;
  district: string;
  subdistrict: string;
}

/**
 * § หยิบชื่อไทยจาก DB แถวแรก — ฟอร์ม intake บังคับ cascade จังหวัด/อำเภอ/ตำบลแล้ว
 * จึงต้องมีข้อมูลจริงจาก seed ไม่งั้น submit ไม่ผ่าน validation
 */
export async function loadFirstGeography(): Promise<Geography> {
  const db = await getDb();
  const row = await firstOrUndefined(
    db
      .select({
        provinceName: provinces.nameTh,
        districtName: districts.nameTh,
        subdistrictName: subDistricts.nameTh,
      })
      .from(villages)
      .innerJoin(subDistricts, eq(villages.subDistrictId, subDistricts.id))
      .innerJoin(districts, eq(subDistricts.districtId, districts.id))
      .innerJoin(provinces, eq(districts.provinceId, provinces.id))
      .limit(1),
  );
  await closeDb();
  // § error ชี้ไป seed-villages ตรง ๆ — ตารางว่างใน env ใหม่ให้ TypeError เปล่าหลอกได้ง่าย
  if (!row) {
    throw new Error('ตาราง geography ว่าง — รัน npx tsx scripts/seed-villages.ts ก่อน (idempotent)');
  }
  return { province: row.provinceName, district: row.districtName, subdistrict: row.subdistrictName };
}

/** กรอก cascade จังหวัด → อำเภอ → ตำบล (หมู่บ้านไม่บังคับ) — รอ option ของระดับถัดไป enable ก่อนทุกครั้ง */
export async function fillGeographyCascade(page: Page, geo: Geography): Promise<void> {
  await page.locator('#province').click();
  await page.getByRole('option', { name: geo.province }).click();
  await expect(page.locator('#district')).toBeEnabled({ timeout: 10_000 });
  await page.locator('#district').click();
  await page.getByRole('option', { name: geo.district }).click();
  await expect(page.locator('#subdistrict')).toBeEnabled({ timeout: 10_000 });
  await page.locator('#subdistrict').click();
  await page.getByRole('option', { name: geo.subdistrict }).click();
}
