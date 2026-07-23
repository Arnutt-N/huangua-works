import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { districts, provinces, subDistricts } from '../src/lib/db/schema';

let testProvince: { id: number; nameTh: string };
let testDistrict: { id: number; nameTh: string };
let testSubdistrict: { id: number; nameTh: string };
let secondProvince: { id: number; nameTh: string };

test.beforeAll(async () => {
  const db = await getDb();

  const provinceRows = await db.select({ id: provinces.id, nameTh: provinces.nameTh }).from(provinces).limit(2);
  testProvince = provinceRows[0]!;
  secondProvince = provinceRows[1]!;

  const districtRow = await db
    .select({ id: districts.id, nameTh: districts.nameTh })
    .from(districts)
    .where(eq(districts.provinceId, testProvince.id))
    .limit(1);
  testDistrict = districtRow[0]!;

  const subdistrictRow = await db
    .select({ id: subDistricts.id, nameTh: subDistricts.nameTh })
    .from(subDistricts)
    .where(eq(subDistricts.districtId, testDistrict.id))
    .limit(1);
  testSubdistrict = subdistrictRow[0]!;

  await closeDb();
});

test('province dropdown loads on page load', async ({ page }) => {
  await page.goto('/intake');
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

test('changing province resets downstream selects', async ({ page }) => {
  await page.goto('/intake');

  await page.locator('#province').click();
  await page.getByRole('option', { name: testProvince.nameTh }).click();
  await expect(page.locator('#district')).toBeEnabled({ timeout: 10_000 });

  await page.locator('#district').click();
  await page.getByRole('option', { name: testDistrict.nameTh }).click();
  await expect(page.locator('#subdistrict')).toBeEnabled({ timeout: 10_000 });

  // change province → district and subdistrict should reset
  await page.locator('#province').click();
  await page.getByRole('option', { name: secondProvince.nameTh }).click();

  await expect(page.locator('#subdistrict')).toBeDisabled();
  await expect(page.locator('#district')).toContainText('เลือกอำเภอ');
});
