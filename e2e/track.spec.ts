import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { cases, categories, consentRecords, users } from '../src/lib/db/schema';
import { generateId } from '../src/lib/id';
import { E2E_CLIENT_IP, resetRateLimits } from './helpers/reset-rate-limits';
import { rateLimitKey } from '../src/lib/rate-limit/policies';

const TEST_USER_EMAIL = 'e2e-track-test@placeholder.local';
const TEST_TRACKING_CODE = 'HN888888881'; // fixed code สำหรับ e2e
const TEST_TRACKING_CODE_RESOLVED = 'HN888888882'; // fixed code เคสเสร็จสิ้นพร้อมภาพถ่าย
let testUserId: string;
let testCaseId: string;
let testResolvedCaseId: string;
let testConsentId: string;

test.beforeAll(async () => {
  await resetRateLimits(rateLimitKey('track', E2E_CLIENT_IP));

  const db = await getDb();

  // § pre-clean กันข้อมูลค้างจากรอบที่ล้มเหลวก่อนหน้า
  await db.delete(cases).where(eq(cases.trackingCode, TEST_TRACKING_CODE));
  await db.delete(cases).where(eq(cases.trackingCode, TEST_TRACKING_CODE_RESOLVED));
  await db.delete(users).where(eq(users.email, TEST_USER_EMAIL));

  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน `pnpm db:seed` ก่อน');

  testUserId = generateId();
  await db.insert(users).values({
    id: testUserId,
    email: TEST_USER_EMAIL,
    role: 'citizen',
    isActive: true,
    fullName: 'ผู้แจ้งทดสอบ E2E Track',
  });

  testConsentId = generateId();
  await db.insert(consentRecords).values({
    id: testConsentId,
    userId: testUserId,
    consentType: 'data_collection',
    version: '1.0',
    isGranted: true,
    grantedAt: new Date(),
  });

  testCaseId = generateId();
  await db.insert(cases).values({
    id: testCaseId,
    status: 'reviewing',
    priority: 'normal',
    title: 'เคสทดสอบหน้า track (E2E)',
    description: 'รายละเอียดทดสอบ',
    location: 'ทดสอบ ตำบลหัวงัว',
    categoryId: category.id,
    submittedBy: testUserId,
    trackingCode: TEST_TRACKING_CODE,
  });

  testResolvedCaseId = generateId();
  await db.insert(cases).values({
    id: testResolvedCaseId,
    status: 'done',
    priority: 'normal',
    title: 'เคสทดสอบหน้า track ที่เสร็จสิ้น (E2E)',
    description: 'รายละเอียดทดสอบเคสเสร็จสิ้น',
    location: 'ทดสอบ ตำบลหัวงัว หมู่ 2',
    categoryId: category.id,
    submittedBy: testUserId,
    trackingCode: TEST_TRACKING_CODE_RESOLVED,
    metadata: {
      resolutionPhotos: [
        {
          id: 'res-photo-1',
          key: 'cases/resolutions/test-before.jpg',
          tag: 'before',
          caption: 'ภาพก่อนดำเนินการซ่อมแซม',
          size: 102400,
          type: 'image/jpeg',
          uploadedAt: '2026-11-02T00:00:00.000Z',
          uploadedBy: testUserId,
        },
        {
          id: 'res-photo-2',
          key: 'cases/resolutions/test-after.jpg',
          tag: 'after',
          caption: 'ภาพหลังดำเนินการซ่อมแซมเรียบร้อย',
          size: 102400,
          type: 'image/jpeg',
          uploadedAt: '2026-11-02T01:00:00.000Z',
          uploadedBy: testUserId,
        },
      ],
    },
  });
});

test.afterAll(async () => {
  const db = await getDb();
  await db.delete(cases).where(eq(cases.id, testCaseId));
  await db.delete(cases).where(eq(cases.id, testResolvedCaseId));
  await db.delete(consentRecords).where(eq(consentRecords.id, testConsentId));
  await db.delete(users).where(eq(users.id, testUserId));
  await closeDb();
});

test('auto-loads a case when visiting /track?id=', async ({ page }) => {
  // timeout กว้างกว่าปกติ -- เทสนี้มักเป็นครั้งแรกที่ route /track ถูก compile
  // สดใน dev server (Turbopack) รวมกับ /api/cases/[id] ที่ fetch ตาม อาจใช้เวลา
  // มากกว่า hit ปกติที่ route compile ไว้แล้ว
  await page.goto(`/track?id=${TEST_TRACKING_CODE}`);
  await expect(page.getByText('เคสทดสอบหน้า track (E2E)')).toBeVisible({ timeout: 40_000 });
});

test('manual search by tracking code returns the correct result', async ({ page }) => {
  await page.goto('/track');
  await page.getByLabel('เลขติดตามเรื่อง').fill(TEST_TRACKING_CODE);
  await page.getByRole('button', { name: 'ค้นหาเรื่อง' }).click();
  await expect(page.getByText('เคสทดสอบหน้า track (E2E)')).toBeVisible({ timeout: 10_000 });
});

test('shows a friendly error for a non-existent tracking code', async ({ page }) => {
  await page.goto('/track');
  await page.getByLabel('เลขติดตามเรื่อง').fill('HN000000000');
  await page.getByRole('button', { name: 'ค้นหาเรื่อง' }).click();
  await expect(page.getByText('ไม่พบเรื่องนี้')).toBeVisible();
});

test('empty search is caught client-side without a network call', async ({ page }) => {
  await page.goto('/track');
  // รอ client component hydrate เสร็จก่อน click มิฉะนั้น click ตกที่ native form submit
  // (page reload) แทน React handler → ไม่ตั้งค่า error ฝั่ง client
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'ค้นหาเรื่อง' }).click();
  await expect(page.getByText('กรุณากรอกเลขติดตามเรื่อง')).toBeVisible();
});

test('copy tracking code button copies code and changes text to คัดลอกแล้ว', async ({ page }) => {
  await page.goto(`/track?id=${TEST_TRACKING_CODE}`);
  await expect(page.getByText('เคสทดสอบหน้า track (E2E)')).toBeVisible({ timeout: 40_000 });

  const copyButton = page.getByRole('button', { name: /คัดลอกเลขติดตาม/ });
  await expect(copyButton).toBeVisible();
  await copyButton.click();

  await expect(page.getByText('คัดลอกแล้ว')).toBeVisible();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe(TEST_TRACKING_CODE);
});

test('displays progress percentage and steps for tracking code', async ({ page }) => {
  await page.goto(`/track?id=${TEST_TRACKING_CODE}`);
  await expect(page.getByText('ความคืบหน้าการดำเนินงาน')).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText('38%')).toBeVisible();
  await expect(page.getByText('กำลังตรวจสอบ')).toBeVisible();
});

test('displays staff resolution attachments (Before & After photos) for resolved case', async ({ page }) => {
  await page.goto(`/track?id=${TEST_TRACKING_CODE_RESOLVED}`);
  await expect(page.getByText('เคสทดสอบหน้า track ที่เสร็จสิ้น (E2E)')).toBeVisible({ timeout: 40_000 });

  await expect(page.getByText('ภาพถ่ายผลการดำเนินงานของเจ้าหน้าที่ (Before & After)')).toBeVisible();
  await expect(page.getByText('ก่อนดำเนินการ (Before)')).toBeVisible();
  await expect(page.getByText('หลังดำเนินการ (After)')).toBeVisible();
  await expect(page.getByText('ภาพก่อนดำเนินการซ่อมแซม')).toBeVisible();
  await expect(page.getByText('ภาพหลังดำเนินการซ่อมแซมเรียบร้อย')).toBeVisible();
});
