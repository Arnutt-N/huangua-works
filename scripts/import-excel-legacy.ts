/**
 * นำเข้าทะเบียน Excel ย้อนหลัง — default เป็น dry-run อ่านอย่างเดียวเสมอ
 *
 * ใช้ staging จาก scripts/prepare-excel-intake.py เท่านั้น (ไม่เปิด workbook ตรง)
 * output ทุกบรรทัด sanitized: counts, source_key (hash), เลขแถว — ห้ามพิมพ์ PII
 *
 * dry-run:  npx tsx scripts/import-excel-legacy.ts [--staging <dir>]
 * apply:    npx tsx scripts/import-excel-legacy.ts --apply --operator <userId>
 *             [--resolve-status <key>=<status>] [--resolve-date <key>=<YYYY-MM-DD>]
 *             [--resolve-category <key>=<slug>] [--source-name <name>]
 *
 * § --apply เขียน DB จริง ต้องมี operator ที่เป็น staff และ staging ต้องไม่มีแถวค้าง block
 */

import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  applyImport,
  classifyRows,
  dryRun,
  ImportError,
  parseBundle,
  type Resolution,
} from '../src/lib/import/legacy-import';
import { closeDb, getDb } from '../src/lib/db';
import { firstOrUndefined } from '../src/lib/db/query-helpers';
import { users } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

config({ path: '.env.local', override: false });

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function parseArgs(argv: string[]): {
  staging: string;
  apply: boolean;
  operator?: string;
  sourceName: string;
  resolution: Resolution;
} {
  const out = {
    staging: join('secrets', 'import-preparation', 'staging'),
    apply: false,
    operator: undefined as string | undefined,
    sourceName: 'dashboard-2569',
    resolution: { statusByKey: {}, dateByKey: {}, categoryByKey: {} } as Resolution,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') {
      out.apply = true;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined) fail(`ตัวเลือก ${arg} ต้องมีค่า (ดูวิธีใช้ในหัวไฟล์)`);
    if (arg === '--staging') out.staging = next;
    else if (arg === '--operator') out.operator = next;
    else if (arg === '--source-name') out.sourceName = next;
    else if (arg === '--resolve-status' || arg === '--resolve-date' || arg === '--resolve-category') {
      const flag = next;
      const eqIndex = flag.indexOf('=');
      if (eqIndex < 0) fail(`รูปแบบ ${arg} ต้องเป็น <source_key>=<ค่า>`);
      const key = flag.slice(0, eqIndex);
      const value = flag.slice(eqIndex + 1);
      if (arg === '--resolve-status') out.resolution.statusByKey[key] = value;
      else if (arg === '--resolve-date') out.resolution.dateByKey[key] = value;
      else out.resolution.categoryByKey[key] = value;
    } else {
      fail(`ตัวเลือกไม่รู้จัก: ${arg} (ดูวิธีใช้ในหัวไฟล์)`);
    }
    i++;
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const stagingDir = resolve(args.staging);

  // § staging ต้องอยู่ใต้ secrets/ ที่ gitignore เท่านั้น
  const repoRoot = resolve(process.cwd());
  const secretsRoot = resolve(repoRoot, 'secrets');
  if (!stagingDir.startsWith(secretsRoot)) fail('staging ต้องอยู่ใต้ secrets/ เท่านั้น');
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync('git', ['check-ignore', '-q', stagingDir], { cwd: repoRoot, stdio: 'ignore' });
  } catch {
    fail('staging ไม่อยู่ใน gitignore หยุดเพื่อกันข้อมูลหลุดเข้า git');
  }

  const names = ['rows.jsonl', 'review-queue.jsonl', 'summary.json', 'manifest.json', 'ownership.json'] as const;
  const files = new Map<string, Buffer>();
  for (const name of names) {
    try {
      files.set(name, readFileSync(join(stagingDir, name)));
    } catch {
      fail(`ไม่พบไฟล์ staging: ${name}`);
    }
  }

  let bundle;
  try {
    bundle = parseBundle(files.get('manifest.json')!.toString('utf8'), files.get('review-queue.jsonl')!.toString('utf8'), files.get('rows.jsonl')!.toString('utf8'));
  } catch (error) {
    fail(error instanceof ImportError ? error.message : 'อ่าน staging ไม่สำเร็จ');
  }

  // § ตรวจ hash ทุกไฟล์กับ manifest ก่อนทำอะไรต่อ — staging ถูกแตะนอกเครื่องมือต้องหยุด
  for (const [name, digest] of Object.entries(bundle.manifest.outputSha256)) {
    if (name === 'manifest.json') continue;
    const actual = files.get(name) ? sha256(files.get(name)!) : null;
    if (actual !== digest) fail(`hash ของ ${name} ไม่ตรง manifest (staging ถูกเปลี่ยน)`);
  }

  const classified = classifyRows(bundle, args.resolution);
  const report = await dryRun(bundle, classified);
  console.log(JSON.stringify(report));

  if (!args.apply) {
    await closeDb();
    return;
  }

  if (!args.operator) fail('--apply ต้องระบุ --operator <userId> ที่เป็น staff');
  const db = await getDb();
  const operator = await firstOrUndefined(
    db.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, args.operator!)).limit(1),
  );
  if (!operator || !operator.isActive || operator.role === 'citizen') fail('operator ต้องเป็น staff ที่ active');
  if (report.batchExists) fail('workbook นี้ถูกนำเข้าแล้ว');
  if (report.blocked > 0) fail(`ยังมี ${report.blocked} แถวค้าง block — เคลียร์ก่อน apply`);

  const result = await applyImport({ bundle, classified, operatorUserId: args.operator!, sourceName: args.sourceName });
  console.log(JSON.stringify({ applied: true, ...result }));
  await closeDb();
}

main().catch(async (error) => {
  console.error(error instanceof ImportError ? error.message : 'นำเข้าไม่สำเร็จ');
  try {
    await closeDb();
  } catch {
    // ignore
  }
  process.exit(1);
});
