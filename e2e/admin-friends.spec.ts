import { expect, test, type Page } from '@playwright/test';
import { eq, inArray } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { lineFriendEvents, lineUsers } from '../src/lib/db/schema';
import { generateId } from '../src/lib/id';
import { pseudonymizeLineId } from '../src/lib/line/identity';
import { E2E_CLIENT_IP, resetRateLimits } from './helpers/reset-rate-limits';
import { rateLimitKey } from '../src/lib/rate-limit/policies';

const ADMIN_EMAIL = 'admin@huangua.go.th';
const ADMIN_PASSWORD = 'ChangeMe123!'; // local dev seed password (scripts/seed.ts)

// § spec นี้ seed เพื่อนของตัวเอง — ไม่พึ่งข้อมูล LINE จริง (pattern เดียวกับ e2e/admin-chat.spec.ts)
const RAW_FOLLOWING = 'U_test_e2e_friends_following';
const RAW_UNFOLLOWED = 'U_test_e2e_friends_unfollowed';
const NAME_FOLLOWING = 'ผู้ใช้ทดสอบเพื่อน E2E ติดตาม';
const NAME_UNFOLLOWED = 'ผู้ใช้ทดสอบเพื่อน E2E เลิกติดตาม';
const seededUserIds: string[] = [];

test.beforeAll(async () => {
  const db = await getDb();

  for (const [raw, name] of [[RAW_FOLLOWING, NAME_FOLLOWING], [RAW_UNFOLLOWED, NAME_UNFOLLOWED]] as const) {
    const id = generateId();
    const p = pseudonymizeLineId(raw);
    await db.insert(lineUsers).values({
      id,
      lineUserIdHash: p.hash,
      lineUserIdEnc: p.enc,
      lineUserIdHashV: p.v,
      displayName: name,
      lastMessageAt: new Date(),
    });
    seededUserIds.push(id);
  }

  const base = Date.now();
  await db.insert(lineFriendEvents).values([
    {
      id: generateId(),
      lineUserId: seededUserIds[0]!,
      event: 'follow',
      webhookEventId: `e2e-fr-${generateId()}`,
      createdAt: new Date(base - 1000),
    },
    {
      id: generateId(),
      lineUserId: seededUserIds[1]!,
      event: 'follow',
      webhookEventId: `e2e-fr-${generateId()}`,
      createdAt: new Date(base - 2000),
    },
    {
      id: generateId(),
      lineUserId: seededUserIds[1]!,
      event: 'unfollow',
      webhookEventId: `e2e-fr-${generateId()}`,
      createdAt: new Date(base - 500),
    },
  ]);
});

test.afterAll(async () => {
  const db = await getDb();
  if (seededUserIds.length > 0) {
    await db.delete(lineFriendEvents).where(inArray(lineFriendEvents.lineUserId, seededUserIds));
    await db.delete(lineUsers).where(inArray(lineUsers.id, seededUserIds));
  }
  await closeDb();
});

test.beforeEach(async () => {
  await resetRateLimits(rateLimitKey('adminLoginIp', E2E_CLIENT_IP), rateLimitKey('adminLoginEmail', ADMIN_EMAIL));
});

async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('อีเมล').fill(ADMIN_EMAIL);
  await page.getByLabel('รหัสผ่าน').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /เข้าระบบ/ }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });
}

test.describe('admin friends page', () => {
  test('unauthenticated visitors are redirected from /admin/friends to login', async ({ page }) => {
    await page.goto('/admin/friends');
    await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
  });

  test('authenticated supervisor sees the friends table with follow states', async ({ page }) => {
    test.slow(); // Turbopack compile on slow FS
    await loginAsAdmin(page);

    await page.goto('/admin/friends', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/friends$/);

    await expect(page.getByText(NAME_FOLLOWING)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(NAME_UNFOLLOWED)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('ติดตามอยู่').first()).toBeVisible();
    await expect(page.getByText('เลิกติดตาม').first()).toBeVisible();
  });

  test('search narrows the friends table', async ({ page }) => {
    test.slow();
    await loginAsAdmin(page);
    await page.goto('/admin/friends', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(NAME_FOLLOWING)).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('ค้นหาเพื่อน').fill('เลิกติดตาม');
    await expect(page.getByText(NAME_UNFOLLOWED)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(NAME_FOLLOWING)).toBeHidden();
  });

  test('status filter narrows the friends table', async ({ page }) => {
    test.slow();
    await loginAsAdmin(page);
    await page.goto('/admin/friends', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(NAME_FOLLOWING)).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('กรองสถานะ').selectOption('unfollowed');
    await expect(page.getByText(NAME_UNFOLLOWED)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(NAME_FOLLOWING)).toBeHidden();
  });
});
