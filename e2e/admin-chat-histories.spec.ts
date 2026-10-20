import { expect, test, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { chatConversations, chatMessages, lineUsers } from '../src/lib/db/schema';
import { generateId } from '../src/lib/id';
import { pseudonymizeLineId } from '../src/lib/line/identity';
import { E2E_CLIENT_IP, resetRateLimits } from './helpers/reset-rate-limits';
import { rateLimitKey } from '../src/lib/rate-limit/policies';

const ADMIN_EMAIL = 'admin@huangua.go.th';
const ADMIN_PASSWORD = 'ChangeMe123!';

const TEST_LINE_USER_ID = 'U_test_histories_user';
const SEARCH_LINE_USER_ID = 'U_test_histories_search_user';
const TEST_DISPLAY_NAME = 'ผู้ใช้ทดสอบประวัติแชต';
const SEARCH_DISPLAY_NAME = 'สมหญิงค้นหาประวัติ';
const HISTORY_MESSAGE = 'ข้อความประวัติทดสอบ E2E (chat-histories)';

let closedLineUserRowId: string;
let closedConversationId: string;
let openLineUserRowId: string;
let openConversationId: string;
let closedMessageId: string;

test.beforeAll(async () => {
  const db = await getDb();

  closedLineUserRowId = generateId();
  const closedP = pseudonymizeLineId(TEST_LINE_USER_ID);
  await db.insert(lineUsers).values({
    id: closedLineUserRowId,
    lineUserIdHash: closedP.hash,
    lineUserIdEnc: closedP.enc,
    lineUserIdHashV: closedP.v,
    displayName: TEST_DISPLAY_NAME,
  });

  closedConversationId = generateId();
  await db.insert(chatConversations).values({
    id: closedConversationId,
    lineUserIdHash: closedP.hash,
    mode: 'resolved',
    lastMessageText: HISTORY_MESSAGE,
    lastMessageAt: new Date(),
    resolvedAt: new Date(),
  });

  closedMessageId = generateId();
  await db.insert(chatMessages).values({
    id: closedMessageId,
    conversationId: closedConversationId,
    sender: 'user',
    messageType: 'text',
    textContent: HISTORY_MESSAGE,
  });

  // ห้องเปิดค้างไว้ใช้ตรวจฟิลเตอร์ "ปิดแล้ว" เท่านั้น
  openLineUserRowId = generateId();
  const openP = pseudonymizeLineId(SEARCH_LINE_USER_ID);
  await db.insert(lineUsers).values({
    id: openLineUserRowId,
    lineUserIdHash: openP.hash,
    lineUserIdEnc: openP.enc,
    lineUserIdHashV: openP.v,
    displayName: SEARCH_DISPLAY_NAME,
  });

  openConversationId = generateId();
  await db.insert(chatConversations).values({
    id: openConversationId,
    lineUserIdHash: openP.hash,
    mode: 'bot_active',
    lastMessageText: 'ห้องเปิดอยู่ยังไม่ปิดเรื่อง',
    lastMessageAt: new Date(),
  });
});

test.afterAll(async () => {
  const db = await getDb();
  await db.delete(chatMessages).where(eq(chatMessages.id, closedMessageId));
  await db.delete(chatConversations).where(eq(chatConversations.id, closedConversationId));
  await db.delete(chatConversations).where(eq(chatConversations.id, openConversationId));
  await db.delete(lineUsers).where(eq(lineUsers.id, closedLineUserRowId));
  await db.delete(lineUsers).where(eq(lineUsers.id, openLineUserRowId));
  await closeDb();
});

test.beforeEach(async () => {
  await resetRateLimits(rateLimitKey('adminLoginIp', E2E_CLIENT_IP), rateLimitKey('adminLoginEmail', ADMIN_EMAIL));
});

async function loginAsSuperadmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('อีเมล').fill(ADMIN_EMAIL);
  await page.getByLabel('รหัสผ่าน').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /เข้าระบบ/ }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });
}

test.describe('admin chat histories page (read-only)', () => {
  test('unauthenticated visitors are redirected from /admin/chat-histories to login', async ({ page }) => {
    await page.goto('/admin/chat-histories');
    await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
  });

  test('list shows names plus times plus last messages under the closed filter', async ({ page }) => {
    test.slow(); // Turbopack compile on slow FS
    await loginAsSuperadmin(page);

    await page.goto('/admin/chat-histories', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/chat-histories$/);

    await expect(page.getByText(TEST_DISPLAY_NAME)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(HISTORY_MESSAGE).first()).toBeVisible();

    await expect(page.getByRole('button', { name: /ปิดแล้ว/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(SEARCH_DISPLAY_NAME)).toBeHidden();

    await page.getByRole('button', { name: /ทั้งหมด/ }).click();
    await expect(page.getByText(SEARCH_DISPLAY_NAME)).toBeVisible();
  });

  test('search narrows the list client-side', async ({ page }) => {
    test.slow();
    await loginAsSuperadmin(page);

    await page.goto('/admin/chat-histories', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(TEST_DISPLAY_NAME)).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('ค้นหาประวัติการสนทนา').fill('สมหญิงค้นหา');
    await expect(page.getByText(TEST_DISPLAY_NAME)).toBeHidden();
  });

  test('opening a room shows history with no composer and no mode controls', async ({ page }) => {
    test.slow();
    await loginAsSuperadmin(page);

    await page.goto('/admin/chat-histories', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(TEST_DISPLAY_NAME)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('link', { name: new RegExp(TEST_DISPLAY_NAME) }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/chat-histories/${closedConversationId}$`));

    await expect(page.getByText(HISTORY_MESSAGE)).toBeVisible({ timeout: 20_000 });

    await expect(page.getByLabel('พิมพ์ข้อความ')).toBeHidden();
    await expect(page.getByRole('button', { name: /ส่ง/ })).toBeHidden();
    await expect(page.getByRole('button', { name: /บอท|เจ้าหน้าที่|ปิดเรื่อง|โอนแชท/ })).toBeHidden();

    await page.getByRole('link', { name: /กลับประวัติการสนทนา/ }).click();
    await expect(page).toHaveURL(/\/admin\/chat-histories$/);
  });

  test('masked ids only — no raw LINE id leaks into the list page', async ({ page }) => {
    test.slow();
    await loginAsSuperadmin(page);

    await page.goto('/admin/chat-histories', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(TEST_DISPLAY_NAME)).toBeVisible({ timeout: 20_000 });

    const body = await page.textContent('body');
    expect(body).not.toContain(TEST_LINE_USER_ID);
    expect(body).not.toContain(SEARCH_LINE_USER_ID);
  });
});
