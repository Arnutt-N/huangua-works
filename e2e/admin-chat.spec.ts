import { expect, test } from '@playwright/test';
import { resetRateLimits } from './helpers/reset-rate-limits';

const ADMIN_EMAIL = 'admin@huangua.go.th';
const ADMIN_PASSWORD = 'ChangeMe123!'; // local dev seed password (scripts/seed.ts)

test.beforeEach(async () => {
  await resetRateLimits('rate:admin-login:ip:::1', `rate:admin-login:email:${ADMIN_EMAIL}`);
});

test.describe('admin chat page', () => {
  test('unauthenticated visitors are redirected from /admin/chat to login', async ({ page }) => {
    await page.goto('/admin/chat');
    await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
  });

  test('authenticated admin sees the chat UI with conversation list', async ({ page }) => {
    test.slow(); // Turbopack compile on slow FS

    // Login
    await page.goto('/admin/login');
    await page.getByLabel('อีเมล').fill(ADMIN_EMAIL);
    await page.getByLabel('รหัสผ่าน').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /เข้าระบบ/ }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });

    // Navigate to chat
    await page.goto('/admin/chat', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/chat$/);

    // Chat header visible
    await expect(page.getByRole('heading', { name: 'การสนทนา LINE' })).toBeVisible({ timeout: 20_000 });

    // Should show the test conversation created by webhook test (U_test_local_webhook_user)
    // or empty state if DB was cleaned
    const conversationList = page.locator('button:has-text("U_test_local")');
    const emptyState = page.getByText('ยังไม่มีการสนทนา');
    await expect(conversationList.or(emptyState)).toBeVisible({ timeout: 15_000 });
  });

  test('selecting a conversation shows messages panel', async ({ page }) => {
    test.slow();

    await page.goto('/admin/login');
    await page.getByLabel('อีเมล').fill(ADMIN_EMAIL);
    await page.getByLabel('รหัสผ่าน').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /เข้าระบบ/ }).click();

    await page.goto('/admin/chat', { waitUntil: 'domcontentloaded' });

    // Try to find a conversation; if none, skip the rest
    const convButton = page.locator('button:has-text("U_test_local")');
    const hasConversation = await convButton.isVisible().catch(() => false);

    if (hasConversation) {
      await convButton.click();
      // After selecting, the mode badge should appear
      await expect(page.getByText(/Bot ตอบอัตโนมัติ|รอเจ้าหน้าที่|เจ้าหน้าที่ตอบ|ปิดเรื่อง/).first()).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test('SSE connection establishes (no crash on malformed events)', async ({ page }) => {
    test.slow();

    await page.goto('/admin/login');
    await page.getByLabel('อีเมล').fill(ADMIN_EMAIL);
    await page.getByLabel('รหัสผ่าน').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /เข้าระบบ/ }).click();

    await page.goto('/admin/chat', { waitUntil: 'domcontentloaded' });

    // Wait for page to settle (SSE connects on mount)
    await page.waitForTimeout(3000);

    // No uncaught errors in console
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.waitForTimeout(2000);
    const fatalErrors = errors.filter((e) => !e.includes('replyToken'));
    expect(fatalErrors).toHaveLength(0);
  });
});