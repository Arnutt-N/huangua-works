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

function labLightness(color: string): number {
  const lightness = Number(/^lab\(\s*(-?[\d.]+)/.exec(color)?.[1]);
  if (!Number.isFinite(lightness)) throw new Error(`อ่านค่าสีไม่ได้: ${color}`);
  return lightness;
}

async function readTooltipColors(page: Page) {
  const bubble = page.locator('[data-side]').last();
  await expect(bubble).toBeVisible({ timeout: 10_000 });
  await expect(bubble).toContainText('ประวัติการสนทนา');
  return bubble.evaluate((el) => {
    const style = getComputedStyle(el);
    const arrow = el.querySelector<HTMLElement>('span[aria-hidden="true"]');
    if (!arrow) throw new Error('ไม่พบลูกศรทูลทิป');
    return {
      bg: style.backgroundColor,
      fg: style.color,
      arrow: getComputedStyle(arrow).backgroundColor,
      border: style.borderTopWidth,
    };
  });
}

test('ทูลทิปกลับสีตามธีม ทั้งสว่างและมืด', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await page.evaluate(() => window.localStorage.setItem('admin:sidebar-collapsed', '1'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'ขยายแถบเมนู' })).toBeVisible({ timeout: 20_000 });

  await page.getByRole('link', { name: 'ประวัติการสนทนา' }).hover();
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  const light = await readTooltipColors(page);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  const dark = await readTooltipColors(page);

  expect(labLightness(light.bg)).toBeLessThan(50);
  expect(labLightness(light.fg)).toBeGreaterThan(70);
  expect(labLightness(dark.bg)).toBeGreaterThan(70);
  expect(labLightness(dark.fg)).toBeLessThan(50);
  expect(light.arrow).toBe(light.bg);
  expect(dark.arrow).toBe(dark.bg);
  expect(light.border).toBe('0px');
});

test('หลังเข้าสู่ระบบเห็นแถบเมนูโดยไม่ต้องรีเฟรช', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await expect(page.locator('#admin-sidebar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ย่อแถบเมนู' })).toBeVisible();
});
