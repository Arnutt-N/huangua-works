import { expect, test, type Page } from '@playwright/test';
import { E2E_CLIENT_IP, resetRateLimits } from './helpers/reset-rate-limits';
import { rateLimitKey } from '../src/lib/rate-limit/policies';

const ADMIN_EMAIL = 'admin@huangua.go.th';
const ADMIN_PASSWORD = 'ChangeMe123!';

async function login(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/login');
  await page.getByLabel('อีเมล').fill(ADMIN_EMAIL);
  await page.getByLabel('รหัสผ่าน').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /เข้าระบบ/ }).click();
  await page.waitForURL(/\/admin$/, { timeout: 120_000, waitUntil: 'domcontentloaded' });
}

test.beforeEach(async () => {
  await resetRateLimits(rateLimitKey('adminLoginIp', E2E_CLIENT_IP), rateLimitKey('adminLoginEmail', ADMIN_EMAIL));
});

test('sidebar ย่อแล้วยังเรียกเมนูด้วยชื่อเดิมได้', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await page.evaluate(() => window.localStorage.setItem('admin:sidebar-collapsed', '1'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'ขยายแถบเมนู' })).toBeVisible({ timeout: 20_000 });
  const link = page.getByRole('link', { name: 'ประวัติการสนทนา' });
  await expect(link).toHaveAttribute('aria-label', 'ประวัติการสนทนา');
  await expect(link.locator('span[data-ds-allow-clip]')).toBeHidden();
});

test('sidebar กาง: โฟกัสเมนูที่อ่านได้ไม่มีทูลทิป', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  const link = page.getByRole('link', { name: /ประวัติการสนทนา/ });
  await expect(link.locator('span[data-ds-allow-clip]')).toBeVisible();
  await link.focus();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});
