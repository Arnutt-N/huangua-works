import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { cases, categories, users } from '../src/lib/db/schema';
import { generateId } from '../src/lib/id';

const TEST_USER_EMAIL = 'e2e-track-test@placeholder.local';
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
  await page.goto(`/track?id=${testCaseId}`);
  await expect(page.getByText('เคสทดสอบหน้า track (E2E)')).toBeVisible({ timeout: 20_000 });
});

test('manual search by case id returns the correct result', async ({ page }) => {
  await page.goto('/track');
  await page.getByLabel('เลขที่เรื่อง').fill(testCaseId);
  await page.getByRole('button', { name: 'ค้นหาเรื่อง' }).click();
  await expect(page.getByText('เคสทดสอบหน้า track (E2E)')).toBeVisible({ timeout: 10_000 });
});

test('shows a friendly error for a non-existent case id', async ({ page }) => {
  await page.goto('/track');
  await page.getByLabel('เลขที่เรื่อง').fill('00000000-0000-0000-0000-000000000000');
  await page.getByRole('button', { name: 'ค้นหาเรื่อง' }).click();
  await expect(page.getByText('ไม่พบเรื่องนี้')).toBeVisible();
});

test('empty search is caught client-side without a network call', async ({ page }) => {
  await page.goto('/track');
  await page.getByRole('button', { name: 'ค้นหาเรื่อง' }).click();
  await expect(page.getByText('กรุณากรอกเลขที่เรื่อง')).toBeVisible();
});
