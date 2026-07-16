import { expect, test } from '@playwright/test';
import { resetRateLimits } from './helpers/reset-rate-limits';

const ADMIN_EMAIL = 'admin@huangua.go.th';
const ADMIN_PASSWORD = 'ChangeMe123!'; // local dev seed password (scripts/seed.ts)

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

  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'แดชบอร์ดเจ้าหน้าที่' })).toBeVisible();

  // already authenticated -> visiting /admin/login bounces back to /admin
  await page.goto('/admin/login');
  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });

  // logout clears the session and re-gates the route
  await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
  await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/, { timeout: 10_000 });

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
});
