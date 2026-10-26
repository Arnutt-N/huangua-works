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

function isExcluded(file: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => file.startsWith(p));
}

function isLightTheme(file: string): boolean {
  return file.endsWith('-light.png');
}

export function diffDirs(beforeDir: string, afterDir: string): string[] {
  const diffs: string[] = [];
  if (!existsSync(beforeDir)) return [`missing before dir: ${beforeDir}`];
  if (!existsSync(afterDir)) return [`missing after dir: ${afterDir}`];

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
