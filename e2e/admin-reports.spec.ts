import { expect, test, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { cases, categories, users } from '../src/lib/db/schema';
import { generateId } from '../src/lib/id';
import { E2E_CLIENT_IP, resetRateLimits } from './helpers/reset-rate-limits';
import { rateLimitKey } from '../src/lib/rate-limit/policies';

const ADMIN_EMAIL = 'admin@huangua.go.th';
const ADMIN_PASSWORD = 'ChangeMe123!';
const TEST_REPORT_CASE_CODE = 'HN888888889';

let testUserId: string;
let testCaseId: string;

test.beforeAll(async () => {
  const db = await getDb();

  // pre-clean กันข้อมูลค้างจากรอบที่ล้มเหลวก่อนหน้า
  await db.delete(cases).where(eq(cases.trackingCode, TEST_REPORT_CASE_CODE));

  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน seed ก่อน');

  testUserId = generateId();
  await db.insert(users).values({
    id: testUserId,
    email: 'e2e-reports-test@placeholder.local',
    role: 'citizen',
    isActive: true,
    fullName: 'ผู้แจ้งทดสอบ E2E Reports',
  });

  testCaseId = generateId();
  await db.insert(cases).values({
    id: testCaseId,
    status: 'in_progress',
    priority: 'normal',
    title: 'เคสทดสอบสำหรับรายงาน CSV (E2E)',
    description: 'รายละเอียดเคสทดสอบสำหรับรายงาน CSV',
    location: 'บ้านหัวงัว หมู่ 2',
    categoryId: category.id,
    submittedBy: testUserId,
    trackingCode: TEST_REPORT_CASE_CODE,
  });
});

test.afterAll(async () => {
  const db = await getDb();
  await db.delete(cases).where(eq(cases.trackingCode, TEST_REPORT_CASE_CODE));
  if (testUserId) {
    await db.delete(users).where(eq(users.id, testUserId));
  }
  await closeDb();
});

test.beforeEach(async () => {
  await resetRateLimits(
    rateLimitKey('adminLoginIp', E2E_CLIENT_IP),
    rateLimitKey('adminLoginEmail', ADMIN_EMAIL),
  );
});

async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('อีเมล').fill(ADMIN_EMAIL);
  await page.getByLabel('รหัสผ่าน').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /เข้าระบบ/ }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
}

test.describe('admin reports and export', () => {
  test('unauthenticated visitors are redirected from /admin/reports to login', async ({ page }) => {
    await page.goto('/admin/reports');
    await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
  });

  test('unauthenticated visitors are redirected from /admin/reports/pmqa to login', async ({ page }) => {
    await page.goto('/admin/reports/pmqa');
    await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
  });

  test('authenticated staff can export cases CSV on /admin/reports', async ({ page }) => {
    test.slow();
    await loginAsAdmin(page);

    await page.goto('/admin/reports');
    await expect(page).toHaveURL(/\/admin\/reports$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'จัดการเรื่อง' })).toBeVisible();

    const exportLink = page.getByRole('link', {
      name: 'ส่งออกข้อมูลเรื่องร้องเรียนเป็นไฟล์ CSV',
    });
    await expect(exportLink).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await exportLink.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^cases-report-.*\.csv$/);
  });

  test('authenticated staff can view PMQA report and trigger print', async ({ page }) => {
    test.slow();

    await page.addInitScript(() => {
      (window as unknown as { __printInvoked?: boolean }).__printInvoked = false;
      window.print = () => {
        (window as unknown as { __printInvoked?: boolean }).__printInvoked = true;
      };
    });

    await loginAsAdmin(page);

    await page.goto('/admin/reports/pmqa');
    await expect(page).toHaveURL(/\/admin\/reports\/pmqa/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /รายงานตามเกณฑ์ PMQA/ })).toBeVisible();

    await expect(page.getByText('เรื่องร้องเรียนทั้งหมด')).toBeVisible();
    await expect(page.getByText('ดำเนินการแล้วเสร็จ')).toBeVisible();

    const printButton = page.getByRole('button', { name: 'พิมพ์รายงาน' });
    await expect(printButton).toBeVisible();
    await printButton.click();

    const isPrintInvoked = await page.evaluate(() => {
      return (window as unknown as { __printInvoked?: boolean }).__printInvoked === true;
    });
    expect(isPrintInvoked).toBe(true);
  });
});
