import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { cases, categories, lineUsers, users } from '../src/lib/db/schema';
import { generateId } from '../src/lib/id';
import { resetRateLimits } from './helpers/reset-rate-limits';

/**
 * E2E ของ "เรื่องของฉัน" ใน /track ผ่าน LIFF mock — เงื่อนไขเดียวกับ intake-liff.spec
 *   LIFF_E2E_MOCK=1 npx playwright test e2e/track-liff.spec.ts
 */
test.skip(process.env.LIFF_E2E_MOCK !== '1', 'ต้องรันด้วย LIFF_E2E_MOCK=1');

const MOCK_LINE_USER = 'Ue2eliffmock02';
const MOCK_LINE_EMAIL = `line-${MOCK_LINE_USER}@placeholder.local`;
const TEST_TRACKING_CODE = 'HN777777772'; // fixed code สำหรับ e2e
let testUserId: string;
let testLineUserId: string;
let testCaseId: string;

test.beforeAll(async () => {
  await resetRateLimits('rate:liff-session:::1');

  const db = await getDb();
  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน `npx tsx scripts/seed.ts` ก่อน');

  testUserId = generateId();
  await db.insert(users).values({
    id: testUserId,
    email: MOCK_LINE_EMAIL,
    role: 'citizen',
    isActive: true,
    fullName: 'ผู้ใช้ LINE ทดสอบ Track',
  });

  testLineUserId = generateId();
  await db.insert(lineUsers).values({
    id: testLineUserId,
    lineUserId: MOCK_LINE_USER,
    displayName: 'ผู้ใช้ LINE ทดสอบ Track',
    linkedUserId: testUserId,
  });

  testCaseId = generateId();
  await db.insert(cases).values({
    id: testCaseId,
    status: 'received',
    priority: 'normal',
    title: 'เคสทดสอบเรื่องของฉัน (LIFF E2E)',
    description: 'รายละเอียดทดสอบ',
    location: 'ทดสอบ ตำบลหัวงัว',
    categoryId: category.id,
    submittedBy: testUserId,
    trackingCode: TEST_TRACKING_CODE,
  });

  await closeDb();
});

test.afterAll(async () => {
  const db = await getDb();
  await db.delete(cases).where(eq(cases.id, testCaseId));
  await db.delete(lineUsers).where(eq(lineUsers.id, testLineUserId));
  await db.delete(users).where(eq(users.id, testUserId));
  await closeDb();
});

test('เข้า /track จาก LIFF → เห็น "เรื่องของฉัน" โดยไม่พิมพ์รหัส', async ({ page }) => {
  // timeout กว้าง — route /track compile สดครั้งแรก + provider ต้องสร้าง session
  // แล้ว router.refresh() ให้ server component เห็น cookie รอบสอง
  await page.goto(`/track?liffmock=${MOCK_LINE_USER}`);

  await expect(page.getByRole('heading', { name: 'เรื่องของฉัน' })).toBeVisible({ timeout: 40_000 });
  const list = page.getByTestId('my-cases-list');
  await expect(list).toBeVisible();
  await expect(list.getByText('เคสทดสอบเรื่องของฉัน (LIFF E2E)')).toBeVisible();
  await expect(list.getByText(TEST_TRACKING_CODE)).toBeVisible();
});

test('เข้า /track แบบเว็บธรรมดา (ไม่มี session) → ไม่มี section เรื่องของฉัน', async ({ browser }) => {
  const fresh = await browser.newPage();
  await fresh.goto('/track');
  await expect(fresh.getByRole('heading', { name: 'เรื่องของฉัน' })).toBeHidden({ timeout: 20_000 });
  await expect(fresh.getByLabel('เลขติดตามเรื่อง')).toBeVisible();
  await fresh.close();
});
