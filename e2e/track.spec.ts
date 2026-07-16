import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { cases, categories, users } from '../src/lib/db/schema';
import { generateId } from '../src/lib/id';

const TEST_USER_EMAIL = 'e2e-track-test@placeholder.local';
const TEST_TRACKING_CODE = 'HN888888881'; // fixed code สำหรับ e2e
let testUserId: string;
let testCaseId: string;

test.beforeAll(async () => {
  const db = await getDb();

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
});

test.afterAll(async () => {
  const db = await getDb();
  await db.delete(cases).where(eq(cases.id, testCaseId));
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
