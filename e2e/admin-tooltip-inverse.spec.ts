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

test('หลังเข้าสู่ระบบเห็นแถบเมนูโดยไม่ต้องรีเฟรช', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await expect(page.locator('#admin-sidebar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ย่อแถบเมนู' })).toBeVisible();
});
