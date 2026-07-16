import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db';
import { cases, dedupHashes, users } from '../src/lib/db/schema';
import { resetRateLimits } from './helpers/reset-rate-limits';

const TEST_CID = '1101200563040';
const TEST_EMAIL = `cid-${TEST_CID}@placeholder.local`;
const createdCaseIds: string[] = [];

test.beforeAll(async () => {
  // ::1 คือ IP ที่ request จาก Playwright (ผ่าน localhost) เห็นจริงบนเครื่องนี้
  await resetRateLimits('rate:submit:::1');
});

test.afterAll(async () => {
  const db = await getDb();
  for (const id of createdCaseIds) {
    await db.delete(dedupHashes).where(eq(dedupHashes.caseId, id));
    await db.delete(cases).where(eq(cases.id, id));
  }
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
  await closeDb();
});

test('submitting an empty form shows validation errors without a network call', async ({ page }) => {
  await page.goto('/intake');
  await page.getByRole('button', { name: 'ส่งเรื่อง' }).click();

  await expect(page.getByText('กรุณากรอกชื่อ-นามสกุล')).toBeVisible();
  await expect(page.getByText('เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก)')).toBeVisible();
  await expect(page.getByText('กรุณายินยอมให้เก็บข้อมูลก่อนส่งเรื่อง')).toBeVisible();
});

test('golden path: filling and submitting creates a real case', async ({ page }) => {
  await page.goto('/intake');

  await page.getByLabel('ชื่อ - นามสกุล').fill('ทดสอบ E2E Playwright');
  await page.getByLabel('เลขบัตรประชาชน 13 หลัก').fill(TEST_CID);
  await page.getByLabel('หมวดเรื่อง').click();
  await page.getByRole('option').first().click();
  await page.getByLabel('หัวเรื่อง').fill(`ทดสอบ E2E intake ${Date.now()}`);
  await page.getByLabel('รายละเอียด').fill('ทดสอบฟอร์มแจ้งเรื่องผ่าน Playwright E2E ถาวร');
  await page.getByLabel('ที่อยู่ / จุดที่เกิดเรื่อง').fill('ทดสอบ ตำบลหัวงัว');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'ส่งเรื่อง' }).click();

  await expect(page.getByRole('heading', { name: 'รับเรื่องเรียบร้อย' })).toBeVisible({
    timeout: 10_000,
  });

  // § อ่าน tracking code (HN...) และ caseId (UUID — เก็บไว้ใน data attribute สำหรับ cleanup)
  const trackingCodeEl = page.getByTestId('tracking-code');
  const trackingCode = (await trackingCodeEl.textContent())?.trim();
  expect(trackingCode).toMatch(/^HN\d{9}$/);
  const caseId = await trackingCodeEl.getAttribute('data-case-id');
  expect(caseId).toBeTruthy();
  if (caseId) createdCaseIds.push(caseId);

  await expect(page.getByRole('link', { name: 'ติดตามเรื่องนี้' })).toHaveAttribute(
    'href',
    `/track?id=${trackingCode}`
  );
});
