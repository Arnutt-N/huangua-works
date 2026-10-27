#!/usr/bin/env tsx
/**
 * diff-baseline.ts — เทียบภาพ baseline ก่อน/หลัง tranche ด้วย byte compare
 *
 * ใช้งาน: npx tsx scripts/diff-baseline.ts <before-dir> <after-dir>
 * คืน exit code 0 เมื่อภาพทุกไฟล์(ที่ไม่ยกเว้น)เท่ากันทุกไบต์, exit code 1 เมื่อมีไฟล์ต่าง/หาย/เกิน
 * (ให้ CI-local/commit hook เรียกได้)
 *
 * § ห้ามเพิ่ม dependency — ใช้ fs Buffer เท่านั้น (ไม่มี pixelmatch/pngjs);
 * กฎยกเว้น (ตาม docs/baseline/README.md):
 * - 3 routes ที่มีเวลาสัมพัทธ์/สถิติ (`home`, `admin_reports`, `admin_cases_*`) → ตรวจแค่มีไฟล์ครบ ไม่เทียบ byte
 * - light theme มี font-rendering noise → ตรวจแค่มีไฟล์ครบ; gate byte-compare ใช้ dark theme เท่านั้น
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

// prefix ของ slug ที่ยกเว้นจาก byte-compare (ตรวจแค่มีไฟล์ครบ)
const EXCLUDED_PREFIXES = ['home-', 'admin_reports-', 'admin_cases_'];

/**
 * § รายชื่อ route ที่ capture script ต้องเก็บครบเสมอ (slug = path ที่แทน / ด้วย _)
 * gate ต้อง fail เมื่อ "ไม่มีอะไรให้เทียบ" ไม่ใช่ผ่านเงียบ — ทั้งสอง dir ว่าง หรือ
 * มีแต่ไฟล์ยกเว้น = ยังไม่ได้ capture จริง ไม่ใช่ "ภาพนิ่ง"
 */
const REQUIRED_SLUGS = [
  'home',
  'admin',
  'admin_reports',
  'admin_cases',
  'admin_users',
  'admin_chatbot_broadcast_new',
  'admin_chatbot_reply-objects',
  'admin_files',
  'admin_settings',
] as const;

const VIEWPORTS = ['375', '1440'] as const;
const THEMES = ['light', 'dark'] as const;

function expectedFileCount(): number {
  return REQUIRED_SLUGS.length * VIEWPORTS.length * THEMES.length;
}

/** slug ของชื่อไฟล์ เช่น admin_cases_xxx-375-dark.png → admin_cases (ตัด id ต่อท้ายออก) */
function slugOf(file: string): string {
  const m = /^(.*?)-\d+-(?:light|dark)\.png$/.exec(file);
  const raw = m?.[1] ?? file;
  // § /admin/cases/<id> → filename มี uuid ต่อท้าย slug; normalize กลับเป็น admin_cases
  if (raw.startsWith('admin_cases_')) return 'admin_cases';
  return raw;
}

function isExcluded(file: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => file.startsWith(p));
}

function isLightTheme(file: string): boolean {
  return file.endsWith('-light.png');
}

/** § ตรวจว่า dir มีไฟล์ครบตาม route ที่ต้อง capture — คืนข้อความ error ถ้าไม่ครบ */
export function checkCoverage(dir: string): string[] {
  const problems: string[] = [];
  if (!existsSync(dir)) return [`missing dir: ${dir}`];
  const files = readdirSync(dir).filter((f) => f.endsWith('.png'));
  const expected = expectedFileCount();
  if (files.length !== expected) {
    problems.push(`${dir}: พบ ${files.length} ไฟล์ แต่ต้องมี ${expected} (${REQUIRED_SLUGS.length} routes × 2 viewports × 2 themes)`);
  }
  const presentSlugs = new Set(files.map(slugOf));
  for (const slug of REQUIRED_SLUGS) {
    if (!presentSlugs.has(slug)) problems.push(`${dir}: ไม่มี route "${slug}"`);
  }
  return problems;
}

export function diffDirs(beforeDir: string, afterDir: string): string[] {
  const diffs: string[] = [];
  // § gate ต้อง fail เมื่อ capture ไม่ครบ — ไม่ปล่อยให้ dir ว่าง/มีแต่ไฟล์ยกเว้นผ่านเงียบ
  diffs.push(...checkCoverage(beforeDir));
  diffs.push(...checkCoverage(afterDir));
  if (!existsSync(beforeDir) || !existsSync(afterDir)) return diffs;

  const before = new Set(readdirSync(beforeDir));
  const after = new Set(readdirSync(afterDir));

  for (const f of before) {
    if (!after.has(f)) {
      diffs.push(`missing in after: ${f}`);
      continue;
    }
    // หน้ายกเว้น / light theme: ตรวจแค่มีไฟล์ครบ
    if (isExcluded(f)) continue;
    if (isLightTheme(f)) continue;
    const a = readFileSync(join(beforeDir, f));
    const b = readFileSync(join(afterDir, f));
    if (!a.equals(b)) diffs.push(`different: ${f}`);
  }
  for (const f of after) {
    if (!before.has(f)) diffs.push(`extra in after: ${f}`);
  }
  return diffs;
}

const [beforeDir, afterDir] = process.argv.slice(2);
if (!beforeDir || !afterDir) {
  console.error('ใช้: npx tsx scripts/diff-baseline.ts <before-dir> <after-dir>');
  process.exit(2);
}
const diffs = diffDirs(beforeDir, afterDir);
for (const d of diffs) console.log(d);
if (diffs.length > 0) {
  console.log(`FAIL: ${diffs.length} ไฟล์ต่างกัน (${basename(beforeDir)} vs ${basename(afterDir)})`);
  process.exit(1);
}
console.log(`OK: ภาพเท่ากันทุกไฟล์`);
