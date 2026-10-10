import { expect, test } from '@playwright/test';

for (const timezoneId of ['UTC', 'Asia/Bangkok', 'America/Los_Angeles']) {
  test.describe(`ปีงบประมาณเมื่อเขตเวลาเบราว์เซอร์เป็น ${timezoneId}`, () => {
    test.use({ timezoneId });

    for (const [instant, expected] of [
      ['2026-09-30T16:59:59.000Z', 2569],
      ['2026-09-30T17:00:00.000Z', 2570],
    ] as const) {
      test(`ป้ายตรงกับเวลาไทย ณ ${instant}`, async ({ page }) => {
        await page.clock.setFixedTime(new Date(instant));
        await page.goto('/');
        await expect(page.getByText(`ระบบออนไลน์ใหม่ ปีงบประมาณ ${expected}`, { exact: true })).toBeVisible();
      });
    }
  });
}

test('หน้าเปิดค้างข้ามเที่ยงคืนไทยปรับปีภายในหนึ่งนาที', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-30T16:59:00.000Z') });
  await page.clock.pauseAt(new Date('2026-09-30T16:59:59.000Z'));
  await page.goto('/');
  await expect(page.getByText('ระบบออนไลน์ใหม่ ปีงบประมาณ 2569', { exact: true })).toBeAttached();
  await page.clock.runFor(60_000);
  await expect(page.getByText('ระบบออนไลน์ใหม่ ปีงบประมาณ 2570', { exact: true })).toBeVisible();
  await expect(page.getByText('ระบบออนไลน์ใหม่ ปีงบประมาณ 2569', { exact: true })).toHaveCount(0);
});
