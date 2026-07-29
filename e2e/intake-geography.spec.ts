import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { districts, provinces, subDistricts, villages } from '../src/lib/db/schema';

let testProvince: { id: number; nameTh: string };
let testDistrict: { id: number; nameTh: string };
let testSubdistrict: { id: number; nameTh: string };
let testVillage: { id: number; nameTh: string };
let secondProvince: { id: number; nameTh: string };

test.beforeAll(async () => {
  const db = await getDb();

  // Start from villages and join upward to guarantee all 4 levels have data.
  const chain = await db
    .select({
      provinceId: provinces.id,
      provinceName: provinces.nameTh,
      districtId: districts.id,
      districtName: districts.nameTh,
      subdistrictId: subDistricts.id,
      subdistrictName: subDistricts.nameTh,
      villageId: villages.id,
      villageName: villages.nameTh,
    })
    .from(villages)
    .innerJoin(subDistricts, eq(villages.subDistrictId, subDistricts.id))
    .innerJoin(districts, eq(subDistricts.districtId, districts.id))
    .innerJoin(provinces, eq(districts.provinceId, provinces.id))
    .limit(1);
  const row = chain[0]!;

  testProvince = { id: row.provinceId, nameTh: row.provinceName };
  testDistrict = { id: row.districtId, nameTh: row.districtName };
  testSubdistrict = { id: row.subdistrictId, nameTh: row.subdistrictName };
  testVillage = { id: row.villageId, nameTh: row.villageName };

  // Pick any province whose id differs from testProvince for the reset test.
  const otherProvince = await db
    .select({ id: provinces.id, nameTh: provinces.nameTh })
    .from(provinces)
    .limit(2);
  secondProvince = otherProvince.find((p) => p.id !== testProvince.id)!;

  await closeDb();
});

test('province dropdown loads on page load', async ({ page }) => {
  await page.goto('/intake', { timeout: 60_000 });
  await page.locator('#province').click();
  const options = page.getByRole('option');
  await expect(options.first()).toBeVisible({ timeout: 15_000 });
  expect(await options.count()).toBeGreaterThanOrEqual(70);
});

test('selecting province loads its districts', async ({ page }) => {
  await page.goto('/intake');

  await page.locator('#province').click();
  await page.getByRole('option', { name: testProvince.nameTh }).click();

  await expect(page.locator('#district')).toBeEnabled({ timeout: 10_000 });
  await page.locator('#district').click();
  await expect(page.getByRole('option', { name: testDistrict.nameTh })).toBeVisible({ timeout: 10_000 });
});

test('selecting district loads its subdistricts', async ({ page }) => {
  await page.goto('/intake');

  await page.locator('#province').click();
  await page.getByRole('option', { name: testProvince.nameTh }).click();

  await expect(page.locator('#district')).toBeEnabled({ timeout: 10_000 });
  await page.locator('#district').click();
  await page.getByRole('option', { name: testDistrict.nameTh }).click();

  await expect(page.locator('#subdistrict')).toBeEnabled({ timeout: 10_000 });
  await page.locator('#subdistrict').click();
  await expect(page.getByRole('option', { name: testSubdistrict.nameTh })).toBeVisible({ timeout: 10_000 });
});

test('selecting subdistrict loads its villages', async ({ page }) => {
  await page.goto('/intake');

  await page.locator('#province').click();
  await page.getByRole('option', { name: testProvince.nameTh }).click();

  await expect(page.locator('#district')).toBeEnabled({ timeout: 10_000 });
  await page.locator('#district').click();
  await page.getByRole('option', { name: testDistrict.nameTh }).click();

  await expect(page.locator('#subdistrict')).toBeEnabled({ timeout: 10_000 });
  await page.locator('#subdistrict').click();
  await page.getByRole('option', { name: testSubdistrict.nameTh }).click();

  await expect(page.locator('#villageId')).toBeEnabled({ timeout: 30_000 });
  await page.locator('#villageId').click();
  await expect(page.getByRole('option', { name: testVillage.nameTh })).toBeVisible({ timeout: 30_000 });
});

test('changing province resets downstream selects', async ({ page }) => {
  await page.goto('/intake');

  await page.locator('#province').click();
  await page.getByRole('option', { name: testProvince.nameTh }).click();
  await expect(page.locator('#district')).toBeEnabled({ timeout: 10_000 });

  await page.locator('#district').click();
  await page.getByRole('option', { name: testDistrict.nameTh }).click();
  await expect(page.locator('#subdistrict')).toBeEnabled({ timeout: 10_000 });

  await page.locator('#subdistrict').click();
  await page.getByRole('option', { name: testSubdistrict.nameTh }).click();
  await expect(page.locator('#villageId')).toBeEnabled({ timeout: 10_000 });

  // change province → district, subdistrict, and village should reset
  await page.locator('#province').click();
  await page.getByRole('option', { name: secondProvince.nameTh }).click();

  await expect(page.locator('#district')).toContainText('เลือกอำเภอ');
  await expect(page.locator('#subdistrict')).toBeDisabled();
  await expect(page.locator('#villageId')).toBeDisabled();
});
