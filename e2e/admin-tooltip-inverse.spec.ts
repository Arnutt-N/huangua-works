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

function labColors(color: string): { r: number; g: number; b: number } {
  const rgb = color.match(/[\d.]+/g)?.map(Number);
  if (!rgb || rgb.length < 3 || rgb.slice(0, 3).some((v) => !Number.isFinite(v))) {
    throw new Error(`อ่านค่าสีไม่ได้: ${color}`);
  }
  const [r, g, b] = rgb as [number, number, number];
  return { r, g, b };
}

function perceptibleLightness(color: string): number {
  const { r, g, b } = labColors(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function readTooltipColors(page: Page) {
  const trigger = page.getByRole('link', { name: 'ประวัติการสนทนา' });
  const bubble = page.locator('[data-side]').filter({ hasText: 'ประวัติการสนทนา' });
  await trigger.hover();
  await expect(bubble).toBeVisible({ timeout: 10_000 });
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

  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  const light = await readTooltipColors(page);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  const dark = await readTooltipColors(page);

  expect(perceptibleLightness(light.bg)).toBeLessThan(perceptibleLightness(light.fg));
  expect(perceptibleLightness(dark.bg)).toBeGreaterThan(perceptibleLightness(dark.fg));
  expect(labColors(light.arrow)).toEqual(labColors(light.bg));
  expect(labColors(dark.arrow)).toEqual(labColors(dark.bg));
  expect(light.border).toBe('0px');
  expect(dark.border).toBe('0px');
});

test('หลังเข้าสู่ระบบเห็นแถบเมนูโดยไม่ต้องรีเฟรช', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await expect(page.locator('#admin-sidebar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ย่อแถบเมนู' })).toBeVisible();
});
