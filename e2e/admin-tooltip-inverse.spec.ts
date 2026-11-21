import { expect, test, type Page } from '@playwright/test';
import { E2E_CLIENT_IP, resetRateLimits } from './helpers/reset-rate-limits';
import { rateLimitKey } from '../src/lib/rate-limit/policies';

const ADMIN_EMAIL = 'admin@huangua.go.th';
const ADMIN_PASSWORD = 'ChangeMe123!';

function lightness(color: string): number {
  const lab = color.match(/lab\(\s*([\d.]+)/);
  if (lab) return Number(lab[1]);
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) throw new Error(`สีที่อ่านไม่ได้: ${color}`);
  const channels = [1, 2, 3].map((index) => {
    const value = Number(match[index]) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const y = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return y <= 0.008856 ? y * 903.3 : 116 * y ** (1 / 3) - 16;
}

async function login(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/login');
  await page.getByLabel('อีเมล').fill(ADMIN_EMAIL);
  await page.getByLabel('รหัสผ่าน').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /เข้าระบบ/ }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 60_000 });
}

test.beforeEach(async () => {
  await resetRateLimits(rateLimitKey('adminLoginIp', E2E_CLIENT_IP), rateLimitKey('adminLoginEmail', ADMIN_EMAIL));
});

test('ทูลทิปกลับสีกับธีม ทั้งสว่างและมืด', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);

  const clip = page.locator('[data-ds-allow-clip]').first();
  await expect(clip).toBeVisible({ timeout: 15_000 });
  await clip.evaluate((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.style.display = 'block';
    el.style.maxWidth = '48px';
  });
  await clip.hover();
  const tooltip = page.locator('[data-side]').last();
  await expect(tooltip).toBeVisible({ timeout: 10_000 });
  await expect(tooltip).toContainClass('bg-tooltip');

  const light = await tooltip.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      className: el.className,
      bg: style.backgroundColor,
      fg: style.color,
      border: style.borderTopWidth,
      token: getComputedStyle(document.documentElement).getPropertyValue('--color-tooltip').trim(),
    };
  });
  console.log(`LIGHT ${JSON.stringify(light)}`);
  expect(lightness(light.bg)).toBeLessThan(45);
  expect(lightness(light.fg)).toBeGreaterThan(90);
  expect(light.border).toBe('0px');
  await page.screenshot({ path: '.verify-evidence/tooltip-light-page.png' });

  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  const dark = await tooltip.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      bg: style.backgroundColor,
      fg: style.color,
      token: getComputedStyle(document.documentElement).getPropertyValue('--color-tooltip').trim(),
    };
  });
  console.log(`DARK ${JSON.stringify(dark)}`);
  expect(lightness(dark.bg)).toBeGreaterThan(80);
  expect(lightness(dark.fg)).toBeLessThan(40);
  await page.screenshot({ path: '.verify-evidence/tooltip-dark-page.png' });
});
