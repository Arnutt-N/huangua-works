import { expect, test, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import {
  cases,
  consentRecords,
  dedupHashes,
  districts,
  lineUsers,
  provinces,
  subDistricts,
  users,
  villages,
} from '../src/lib/db/schema';
import { resetRateLimits } from './helpers/reset-rate-limits';

/**
 * E2E ของ LIFF intake — รันด้วย mock mode เท่านั้น
 *
 * § เงื่อนไขการรัน: dev server ต้องมี env LIFF_E2E_MOCK=1 (server เป็นด่านจริง —
 * ถ้าไม่มี env นี้ POST /api/liff/session จะปฏิเสธ mock token)
 *   LIFF_E2E_MOCK=1 npx playwright test e2e/intake-liff.spec.ts
 */
test.skip(process.env.LIFF_E2E_MOCK !== '1', 'ต้องรันด้วย LIFF_E2E_MOCK=1');

const MOCK_LINE_USER = 'Ue2eliffmock01';
const MOCK_LINE_EMAIL = `line-${MOCK_LINE_USER}@placeholder.local`;
const createdCaseIds: string[] = [];

// geography เป็น required บนฟอร์มปัจจุบัน — หยิบชื่อไทยจาก DB เหมือน intake.spec.ts
let geoProvince: string;
let geoDistrict: string;
let geoSubdistrict: string;

test.beforeAll(async () => {
  await resetRateLimits('rate:submit:::1', 'rate:liff-session:::1');

  const db = await getDb();
  const chain = await db
    .select({
      provinceName: provinces.nameTh,
      districtName: districts.nameTh,
      subdistrictName: subDistricts.nameTh,
    })
    .from(villages)
    .innerJoin(subDistricts, eq(villages.subDistrictId, subDistricts.id))
    .innerJoin(districts, eq(subDistricts.districtId, districts.id))
    .innerJoin(provinces, eq(districts.provinceId, provinces.id))
    .limit(1);
  geoProvince = chain[0]!.provinceName;
  geoDistrict = chain[0]!.districtName;
  geoSubdistrict = chain[0]!.subdistrictName;
  await closeDb();
});

test.afterAll(async () => {
  const db = await getDb();
  for (const id of createdCaseIds) {
    await db.delete(dedupHashes).where(eq(dedupHashes.caseId, id));
    await db.delete(cases).where(eq(cases.id, id));
  }
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, MOCK_LINE_EMAIL)).limit(1);
  if (owner) {
    await db.delete(consentRecords).where(eq(consentRecords.userId, owner.id));
    await db.delete(users).where(eq(users.id, owner.id));
  }
  await db.delete(lineUsers).where(eq(lineUsers.lineUserId, MOCK_LINE_USER));
  await closeDb();
});

async function fillAndSubmit(page: Page, title: string, description: string) {
  await page.goto(`/intake?liffmock=${MOCK_LINE_USER}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('liff-auth-banner')).toBeVisible({ timeout: 20_000 });

  await page.getByLabel('หมวดเรื่อง').click();
  await page.getByRole('option').first().click();
  await page.getByLabel('หัวเรื่อง').fill(title);
  await page.getByLabel('รายละเอียด', { exact: true }).fill(description);

  // cascade จังหวัด → อำเภอ → ตำบล (หมู่บ้านไม่บังคับ) — pattern เดียวกับ intake.spec.ts
  await page.locator('#province').click();
  await page.getByRole('option', { name: geoProvince }).click();
  await expect(page.locator('#district')).toBeEnabled({ timeout: 10_000 });
  await page.locator('#district').click();
  await page.getByRole('option', { name: geoDistrict }).click();
  await expect(page.locator('#subdistrict')).toBeEnabled({ timeout: 10_000 });
  await page.locator('#subdistrict').click();
  await page.getByRole('option', { name: geoSubdistrict }).click();

  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'ส่งเรื่อง' }).click();
}

test('LIFF mode: banner แสดง และไม่มีช่องเลขบัตรประชาชน', async ({ page }) => {
  await page.goto(`/intake?liffmock=${MOCK_LINE_USER}`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByTestId('liff-auth-banner')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('เลขบัตรประชาชน 13 หลัก')).toBeHidden();
  // ฟอร์มยังใช้งานได้ — ช่องอื่นแสดงตามปกติ
  await expect(page.getByLabel('หมวดเรื่อง')).toBeVisible();
});

test('LIFF golden path: ส่งเรื่องได้โดยไม่กรอก CID', async ({ page }) => {
  test.slow();
  await resetRateLimits('rate:submit:::1');

  await fillAndSubmit(page, `ทดสอบ LIFF E2E ${Date.now()}`, 'ทดสอบฟอร์มแจ้งเรื่องผ่าน LIFF mock ถาวร');

  await expect(page.getByRole('heading', { name: 'รับเรื่องเรียบร้อย' })).toBeVisible({
    timeout: 30_000,
  });

  const trackingCodeEl = page.getByTestId('tracking-code');
  const trackingCode = (await trackingCodeEl.textContent())?.trim();
  expect(trackingCode).toMatch(/^HG\d{9}$/);
  const caseId = await trackingCodeEl.getAttribute('data-case-id');
  if (caseId) createdCaseIds.push(caseId);
});

test('LIFF dedup: ส่งเรื่องเดิมซ้ำ (title+description เดิม) ถูกปฏิเสธ', async ({ browser }) => {
  test.slow();
  const dupTitle = `ทดสอบ LIFF dedup ${Date.now()}`;
  const dupDesc = 'ทดสอบกันแจ้งซ้ำผ่านช่องทาง LINE ถาวร';

  // รอบ 1 — ส่งสำเร็จ
  await resetRateLimits('rate:submit:::1');
  const page1 = await browser.newPage();
  await fillAndSubmit(page1, dupTitle, dupDesc);
  await expect(page1.getByRole('heading', { name: 'รับเรื่องเรียบร้อย' })).toBeVisible({ timeout: 30_000 });
  const caseId = await page1.getByTestId('tracking-code').getAttribute('data-case-id');
  if (caseId) createdCaseIds.push(caseId);
  await page1.close();

  // รอบ 2 — เรื่องเดิมจากบัญชี LINE เดิม → 409 duplicate (cookie อยู่ใน context เดิม
  // ของ page1 ที่ปิดไปแล้ว จึงต้อง mock session ใหม่ผ่าน URL param เหมือนเดิม)
  await resetRateLimits('rate:submit:::1');
  const page2 = await browser.newPage();
  await fillAndSubmit(page2, dupTitle, dupDesc);
  await expect(page2.getByText('คุณเคยแจ้งเรื่องนี้ไปแล้วภายใน 7 วัน')).toBeVisible({ timeout: 30_000 });
  await page2.close();
});
