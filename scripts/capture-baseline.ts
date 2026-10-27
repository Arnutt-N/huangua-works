#!/usr/bin/env tsx
/**
 * capture-baseline.ts — ถ่ายภาพ baseline 9 routes ก่อนเริ่มงานแต่ละ tranche
 *
 * ใช้งาน: npx tsx scripts/capture-baseline.ts [commit]
 * output: docs/baseline/<commit>/<route>-<viewport>-<theme>.png
 *
 * Playwright แบบ standalone (ไม่ใช้ test runner): login admin ด้วย seed,
 * ถ่าย viewport 375x812 + 1440x900, theme light + dark (dark ผ่าน setAttribute
 * เพราะ layout.tsx:90 hardcode data-theme="light" — ห้ามแก้ layout)
 *
 * route /admin/cases/[id]: seed.ts ไม่ได้สร้าง case → script สร้างเองด้วย
 * createCase() แล้ว pin trackingCode ลง docs/baseline/README.md
 * route /admin/reports: มี formatAge(Date.now()) → ยกเว้นจาก gate (README)
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.local' });

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@huangua.go.th';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123!';
const OUT_DIR = join('docs', 'baseline', process.argv[2] ?? 'local');

const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '1440', width: 1440, height: 900 },
] as const;
const THEMES = ['light', 'dark'] as const;

// 8 routes ไม่ต้องมี case; /admin/cases/[id] เติมทีหลัง
const STATIC_ROUTES = [
  '/',
  '/admin',
  '/admin/reports',
  '/admin/users',
  '/admin/chatbot/broadcast/new',
  '/admin/chatbot/reply-objects',
  '/admin/files',
  '/admin/settings',
] as const;

async function login(page: Page, attempt = 1): Promise<void> {
  await page.goto(`${BASE_URL}/admin/login`);
  await page.getByLabel('อีเมล').fill(ADMIN_EMAIL);
  await page.getByLabel('รหัสผ่าน').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /เข้าระบบ/ }).click();
  try {
    await page.waitForURL(/\/admin$/, { timeout: 90_000 });
  } catch {
    // § cold Turbopack compile ครั้งแรกของ run ช้า 20-40s/route; retry 1 ครั้งกัน flake
    if (attempt >= 2) throw new Error(`login timeout (attempt ${attempt})`);
    console.log(`login timeout — retry (attempt ${attempt + 1})`);
    // ไม่ต้อง reset rate-limit ซ้ำ: login ครั้งแรกยังไม่ผ่าน rate gate
    await login(page, attempt + 1);
  }
}

async function ensureSeedCase(): Promise<string> {
  // หา case แรกใน DB; ไม่มี → สร้างด้วย createCase
  const { getDb, closeDb } = await import('../src/lib/db/index.js');
  const { cases } = await import('../src/lib/db/schema.js');
  const { firstOrUndefined } = await import('../src/lib/db/query-helpers.js');
  const db = await getDb();
  try {
    const first = await firstOrUndefined(db.select({ id: cases.id }).from(cases).limit(1));
    if (first) return first.id;
    const { createCase } = await import('../src/lib/cases/intake.js');
    const { categories } = await import('../src/lib/db/schema.js');
    const cat = await firstOrUndefined(db.select({ id: categories.id }).from(categories).limit(1));
    if (!cat) throw new Error('no categories in DB — run seed first');
    const res = await createCase({
      channel: 'web',
      title: 'baseline seed',
      description: 'เรื่องสำหรับ baseline screenshot',
      categoryId: cat.id,
    });
    if (!res.ok) throw new Error(`createCase failed: ${res.errorCode}`);
    return res.caseId;
  } finally {
    await closeDb();
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  // § reset rate-limit ก่อน login — ทุก test login จาก IP ::1 เดียวกัน, เกิน 5 ครั้ง/15 นาทีโดนบล็อก
  // pattern เดียวกับ e2e/admin-auth.spec.ts:24 — ห้ามเรียก resetRateLimits() เปล่า ๆ (variadic return ทันที)
  const { resetRateLimits, E2E_CLIENT_IP } = await import('../e2e/helpers/reset-rate-limits.js');
  const { rateLimitKey } = await import('../src/lib/rate-limit/policies.js');
  await resetRateLimits(rateLimitKey('adminLoginIp', E2E_CLIENT_IP), rateLimitKey('adminLoginEmail', ADMIN_EMAIL));
  const caseId = await ensureSeedCase();
  const routes = [...STATIC_ROUTES, `/admin/cases/${caseId}`];
  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      for (const theme of THEMES) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        try {
          await login(page);
          for (const route of routes) {
            const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'home';
            await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 60_000 });
            if (theme === 'dark') {
              await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
              await page.waitForTimeout(500);
            }
            await page.screenshot({ path: join(OUT_DIR, `${slug}-${vp.name}-${theme}.png`) });
            console.log(`captured ${slug}-${vp.name}-${theme}.png`);
          }
        } finally {
          await page.close();
        }
      }
    }
    // pin tracking info ลง README (กัน T0 ข้อ 2 ไม่ deterministic)
    const readme = join('docs', 'baseline', 'README.md');
    if (existsSync(readme)) {
      const cur = readFileSync(readme, 'utf8');
      if (!cur.includes(caseId)) {
        writeFileSync(readme, cur + `\n- caseId สำหรับ baseline: ${caseId} (commit ${process.argv[2] ?? 'local'})\n`);
      }
    } else {
      mkdirSync(join('docs', 'baseline'), { recursive: true });
      writeFileSync(readme, `# Baseline\n\n- caseId สำหรับ baseline: ${caseId} (commit ${process.argv[2] ?? 'local'})\n`);
    }
  } finally {
    await browser.close();
  }
  console.log(`OK: baseline ครบ ${routes.length} routes x 2 viewports x 2 themes → ${OUT_DIR}`);
}

await main();
