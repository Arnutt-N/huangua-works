import { expect, test, type Page } from '@playwright/test';
import { decode } from 'next-auth/jwt';
import { resetRateLimits } from './helpers/reset-rate-limits';

const ADMIN_EMAIL = 'admin@huangua.go.th';
const ADMIN_PASSWORD = 'ChangeMe123!'; // local dev seed password (scripts/seed.ts)

/**
 * Logout flow ใหม่: ปุ่มออกจากระบบย้ายจากท้าย sidebar ไปอยู่ใน dropdown ของ
 * avatar มุมขวาบน และต้องยืนยันใน dialog ก่อนออกจริง (กันกดพลาด)
 */
async function logoutViaUserMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'เมนูผู้ใช้' }).click();
  await page.getByRole('menuitem', { name: 'ออกจากระบบ' }).click();
  await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
}

test.beforeEach(async () => {
  // § reset rate-limit counter ก่อนแต่ละ test — ทุก test login จาก IP ::1 เดียวกัน
  // (Playwright ผ่าน localhost) + email เดียวกัน ถ้ารวมข้าม test เกิน 5 ครั้ง/15 นาที
  // จะโดนจำกัดทำให้ test ถัดไป fail — เปลี่ยนจาก beforeAll เป็น beforeEach หลัง migration
  // ไป Auth.js (signIn ทุกครั้งผ่าน rate-limit ของเรา ไม่เหมือน Supabase ที่มี gate ของตัวเอง)
  await resetRateLimits('rate:admin-login:ip:::1', `rate:admin-login:email:${ADMIN_EMAIL}`);
});

test('unauthenticated visitors are redirected from /admin to /admin/login', async ({ page }) => {
  await page.goto('/admin');
  // § Auth.js authorized() returning false redirects with ?callbackUrl=… query (default behavior).
  // Assert pathname only — do not require empty query string.
  await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
});

test('wrong password shows a generic error and stays on the login page', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('อีเมล').fill(ADMIN_EMAIL);
  await page.getByLabel('รหัสผ่าน').fill('WrongPassword123');
  await page.getByRole('button', { name: /เข้าระบบ/ }).click();

  await expect(page.getByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
});

test('full session lifecycle: login -> dashboard -> bounce-back -> logout -> re-gated', async ({
  page,
}) => {
  // § slow() เพิ่ม timeout ระดับ test 3x (30s → 90s) — Turbopack dev บน slow filesystem
  // compile แต่ละ route ใช้ 20-40s ทำให้ lifecycle test (หลาย navigation) หมดเวลา default 30s
  // (เป็น test infra issue ไม่ใช่ production code — production build ไม่มี compile on-demand)
  test.slow();

  await page.goto('/admin/login');
  await page.getByLabel('อีเมล').fill(ADMIN_EMAIL);
  await page.getByLabel('รหัสผ่าน').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /เข้าระบบ/ }).click();

  // § /admin เจอครั้งแรกของ run = cold Turbopack compile (30-60s ตาม playwright.config)
  // 10s เดิมแฟล็คเมื่อ spec นี้รันก่อน spec อื่นที่แตะ /admin
  await expect(page).toHaveURL(/\/admin$/, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'แดชบอร์ดเจ้าหน้าที่' })).toBeVisible();

  // already authenticated -> visiting /admin/login bounces back to /admin
  await page.goto('/admin/login');
  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });

  // logout clears the session and re-gates the route
  await logoutViaUserMenu(page);
  await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/, { timeout: 10_000 });

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
});

test('login page exposes remember-me, forgot-password link, and contact text', async ({ page }) => {
  await page.goto('/admin/login');

  await expect(page.getByLabel('จดจำฉัน')).toBeVisible();
  await expect(page.getByRole('link', { name: 'ลืมรหัสผ่าน?' })).toBeVisible();
  await expect(page.getByText('ยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบ')).toBeVisible();

  await page.getByRole('link', { name: 'ลืมรหัสผ่าน?' }).click();
  await expect(page).toHaveURL(/\/admin\/forgot-password$/, { timeout: 60_000 });
});

test('remember-me is on by default and controls session lifetime (30d vs 1h)', async ({
  page,
}) => {
  // § ต้อง decode session JWT ตรวจ expiresAt claim โดยตรง — อายุ cookie เท่ากัน 30d เสมอ
  // (session.maxAge) ตัวบังคับอายุ session จริงคือ expiresAt ใน token (jwt callback, src/auth.ts)
  test.skip(!process.env.AUTH_SECRET, 'AUTH_SECRET not set — decode session JWT ไม่ได้');
  test.slow();

  async function loginAndReadExpiresAt(remember: boolean): Promise<number> {
    await page.goto('/admin/login');
    await page.getByLabel('อีเมล').fill(ADMIN_EMAIL);
    await page.getByLabel('รหัสผ่าน').fill(ADMIN_PASSWORD);
    if (remember) {
      await page.getByLabel('จดจำฉัน').check();
    } else {
      await page.getByLabel('จดจำฉัน').uncheck();
    }
    await page.getByRole('button', { name: /เข้าระบบ/ }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });

    // § ทั้ง dev (authjs.session-token) และ prod (__Secure-authjs.session-token) —
    // ชื่อ cookie นี้ใช้เป็น salt ตอน encode ด้วย จึงส่งชื่อจริงที่เจอให้ decode
    const session = (await page.context().cookies()).find((c) =>
      c.name.endsWith('authjs.session-token')
    );
    expect(session, 'session cookie missing after login').toBeTruthy();
    const payload = (await decode({
      token: session!.value,
      secret: process.env.AUTH_SECRET!,
      salt: session!.name,
    })) as { expiresAt?: number } | null;
    expect(payload?.expiresAt, 'expiresAt claim missing in session JWT').toBeTruthy();

    await logoutViaUserMenu(page);
    await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/, { timeout: 10_000 });
    return payload!.expiresAt!;
  }

  // ค่าเริ่มต้น: ติ๊ก "จดจำฉัน" ไว้ให้เลย (เจ้าหน้าที่ใช้ทุกวัน — login แล้วต้องอยู่ยาว)
  await page.goto('/admin/login');
  await expect(page.getByLabel('จดจำฉัน')).toBeChecked();

  const expiresAtRemembered = await loginAndReadExpiresAt(true);
  const daysLeft = (expiresAtRemembered - Date.now() / 1000) / 86400;
  expect(daysLeft, 'ติ๊ก "จดจำฉัน" → session ต้องยาว ~30 วัน').toBeGreaterThan(29);
  expect(daysLeft).toBeLessThanOrEqual(30.1);

  const expiresAtShort = await loginAndReadExpiresAt(false);
  const hoursLeft = (expiresAtShort - Date.now() / 1000) / 3600;
  expect(hoursLeft, 'ไม่ติ๊ก "จดจำฉัน" → session ต้องสั้น ~1 ชั่วโมง').toBeGreaterThan(0.9);
  expect(hoursLeft).toBeLessThanOrEqual(1.1);
});
