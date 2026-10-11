import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import {
  auditLogs,
  cases,
  caseUpdates,
  categories,
  departments,
  importBatches,
  legacyResponsibleMap,
  users,
  consentRecords,
} from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { resolveCitizen } from '@/lib/cases/citizen-access/identity';
import {
  applyImport,
  classifyRows,
  dryRun,
  parseBundle,
} from './legacy-import';

/**
 * legacy import กับ Postgres จริง — ข้อมูลสมมติล้วน (prefix it-legacy)
 * ตรวจ dry-run อ่านอย่างเดียว, apply เขียนครบ, idempotent กัน batch ซ้ำ
 */

const RUN = Date.now();
const OPERATOR_EMAIL = `it-legacy-op-${RUN}@placeholder.local`;
const SUBMITTER_NAME = `ผู้ทดสอบนำเข้า ${RUN}`;
const RAW_RESPONSIBLE = `it-raw-${RUN}`;
const CAT_SLUG = `it-legacy-cat-${RUN}`;
const DEPT_SLUG = `it-legacy-dept-${RUN}`;

const createdCaseIds: string[] = [];
const createdUserIds: string[] = [];
let operatorId = '';
let categoryId = '';
let departmentId = '';
let batchId = '';

const MANIFEST = JSON.stringify({
  source_sha256: `it-src-${RUN}`,
  master_sha256: `it-master-${RUN}`,
  write_gate: 'blocked',
  db_ready: 0,
  output_sha256: { 'rows.jsonl': 'h1', 'review-queue.jsonl': 'h2', 'summary.json': 'h3', 'ownership.json': 'h4' },
});

function rowLine(key: string, row: number, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    source: { workbook_sha256: `it-src-${RUN}`, sheet: 'DATA', row },
    source_key: key,
    original: {
      B: { type: 'string', value: `R${row}` },
      D: { type: 'string', value: 'walk-in' },
      E: { type: 'string', value: SUBMITTER_NAME },
      F: { type: 'string', value: 'บ้านทดสอบ หมู่ที่ 9' },
      H: { type: 'string', value: 'ไฟดับ' },
      I: { type: 'string', value: RAW_RESPONSIBLE },
      J: { type: 'string', value: 'ดำเนินการแล้วเสร็จ' },
      K: { type: 'string', value: '' },
    },
    received_date: '2026-03-10',
    fiscal_year_be: 2569,
    category: { review_state: 'proposed', value: CAT_SLUG, id: categoryId },
    status: { review_state: 'proposed', value: 'done' },
    responsible: { raw: { type: 'string', value: RAW_RESPONSIBLE }, review_state: 'unresolved' },
    review_codes: ['responsible_mapping_unresolved', 'submitter_identity_unresolved'],
    write_gate: 'blocked',
    ...overrides,
  });
}

function queueLine(key: string, row: number, codes: string[]): string {
  return JSON.stringify({
    source_key: key,
    source: { workbook_sha256: `it-src-${RUN}`, sheet: 'DATA', row },
    codes,
    write_gate: 'blocked',
  });
}

/** ดึงตัวเดียวพร้อมตรวจ — แทน non-null assertion ตาม idiom ของ repo */
function only<T>(arr: readonly T[]): T {
  if (arr.length !== 1) throw new Error(`expected exactly one, got ${arr.length}`);
  const item = arr[0];
  if (item === undefined) throw new Error('expected item');
  return item;
}

async function setupMaster(): Promise<void> {
  const db = await getDb();
  operatorId = generateId();
  createdUserIds.push(operatorId);
  await db.insert(users).values({
    id: operatorId,
    email: OPERATOR_EMAIL,
    role: 'officer',
    isActive: true,
    fullName: 'โอเปอเรเตอร์ทดสอบ',
  });
  departmentId = generateId();
  await db.insert(departments).values({ id: departmentId, name: `หน่วยทดสอบ ${RUN}`, slug: DEPT_SLUG });
  categoryId = generateId();
  await db.insert(categories).values({ id: categoryId, name: `หมวดทดสอบ ${RUN}`, slug: CAT_SLUG, defaultDepartmentId: departmentId });
  await db.insert(legacyResponsibleMap).values({
    raw: RAW_RESPONSIBLE,
    departmentId,
    assignedTo: null,
    decidedBy: operatorId,
  });
}

afterAll(async () => {
  const db = await getDb();
  if (createdCaseIds.length) {
    await db.delete(caseUpdates).where(inArray(caseUpdates.caseId, createdCaseIds));
    await db.delete(auditLogs).where(inArray(auditLogs.resourceId, createdCaseIds));
    await db.delete(cases).where(inArray(cases.id, createdCaseIds));
  }
  if (batchId) {
    await db.delete(importBatches).where(inArray(importBatches.id, [batchId]));
  }
  await db.delete(legacyResponsibleMap).where(inArray(legacyResponsibleMap.raw, [RAW_RESPONSIBLE]));
  if (categoryId) await db.delete(categories).where(inArray(categories.id, [categoryId]));
  if (departmentId) await db.delete(departments).where(inArray(departments.id, [departmentId]));
  // § ลบ consent ของ submitter ก่อนลบ users (กัน orphan) — apply ต้องไม่สร้าง consent จึงต้องว่างอยู่แล้ว
  if (createdUserIds.length) {
    const consentRows = await db
      .select({ id: consentRecords.id })
      .from(consentRecords)
      .where(inArray(consentRecords.userId, createdUserIds));
    expect(consentRows).toEqual([]);
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await closeDb();
});

describe('legacy-import · dry-run อ่านอย่างเดียว', () => {
  test('แถวครบ importable 1 แถวค้าง 1 ไม่เขียนอะไรเลย', async () => {
    await setupMaster();
    const bundle = parseBundle(
      MANIFEST,
      `${queueLine('it-key-1', 4, ['responsible_mapping_unresolved', 'submitter_identity_unresolved'])}\n${queueLine('it-key-2', 5, ['status_unresolved'])}\n`,
      `${rowLine('it-key-1', 4)}\n${rowLine('it-key-2', 5, { status: { review_state: 'unresolved', value: null } })}\n`,
    );
    const classified = classifyRows(bundle, { statusByKey: {}, dateByKey: {}, categoryByKey: {} });
    const report = await dryRun(bundle, classified);
    expect(report.records).toBe(2);
    expect(report.importable).toBe(1);
    expect(report.blocked).toBe(1);
    expect(report.dbReady).toBe(0);
    expect(report.batchExists).toBe(false);
    expect(report.blocks).toHaveLength(1);
    expect(only(report.blocks).sourceKey).toBe('it-key-2');
  });
});

describe('legacy-import · resolveCitizen legacy', () => {
  test('ชื่อเดิมได้ user เดิม ชื่อต่างได้คนละ user', async () => {
    const first = await resolveCitizen({ kind: 'legacy', name: SUBMITTER_NAME });
    createdUserIds.push(first);
    const again = await resolveCitizen({ kind: 'legacy', name: `  ${SUBMITTER_NAME}  ` });
    const other = await resolveCitizen({ kind: 'legacy', name: `อีกคน ${RUN}` });
    createdUserIds.push(other);
    expect(again).toBe(first);
    expect(other).not.toBe(first);
  });
});

describe('legacy-import · apply เขียนจริง', () => {
  test('สร้างเคส historical ครบ ไม่สร้าง consent/tracking', async () => {
    const bundle = parseBundle(
      MANIFEST,
      `${queueLine('it-key-1', 4, ['responsible_mapping_unresolved', 'submitter_identity_unresolved'])}\n`,
      `${rowLine('it-key-1', 4)}\n`,
    );
    const classified = classifyRows(bundle, { statusByKey: {}, dateByKey: {}, categoryByKey: {} });
    const result = await applyImport({ bundle, classified, operatorUserId: operatorId, sourceName: 'it-legacy' });
    batchId = result.batchId;
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);

    const db = await getDb();
    const rows = await db.select().from(cases).where(inArray(cases.sourceKey, ['it-key-1']));
    expect(rows).toHaveLength(1);
    const row = only(rows);
    createdCaseIds.push(row.id);
    expect(row.status).toBe('done');
    expect(row.isHistorical).toBe(true);
    expect(row.trackingCode).toBeNull();
    expect(row.closedAt).toBeNull();
    expect(row.dueDate).toBeNull();
    expect(row.createdAt.toISOString()).toBe('2026-03-10T00:00:00.000Z');
    expect(row.legacySubmitterName).toBe(SUBMITTER_NAME);
    expect(row.importBatchId).toBe(batchId);
    expect(row.departmentId).toBe(departmentId);
    expect(row.title).toBe('ไฟดับ');
    createdUserIds.push(row.submittedBy);

    const consentRows = await db
      .select({ id: consentRecords.id })
      .from(consentRecords)
      .where(inArray(consentRecords.userId, [row.submittedBy]));
    expect(consentRows).toEqual([]);

    const batchRows = await db.select().from(importBatches).where(inArray(importBatches.id, [batchId]));
    expect(only(batchRows).importedCount).toBe(1);
    expect(only(batchRows).operatorUserId).toBe(operatorId);
  });

  test('apply ซ้ำ workbook เดิมถูกปฏิเสธ (batch ซ้ำ)', async () => {
    const bundle = parseBundle(
      MANIFEST,
      `${queueLine('it-key-1', 4, ['responsible_mapping_unresolved', 'submitter_identity_unresolved'])}\n`,
      `${rowLine('it-key-1', 4)}\n`,
    );
    const classified = classifyRows(bundle, { statusByKey: {}, dateByKey: {}, categoryByKey: {} });
    await expect(applyImport({ bundle, classified, operatorUserId: operatorId, sourceName: 'it-legacy' })).rejects.toThrow();
  });
});
