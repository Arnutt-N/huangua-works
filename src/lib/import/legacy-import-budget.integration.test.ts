import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import {
  auditLogs,
  cases,
  caseUpdates,
  categories,
  consentRecords,
  departments,
  importBatches,
  legacyResponsibleMap,
  users,
} from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { applyImport, classifyRows, dryRun, parseBundle } from './legacy-import';

/**
 * Slice A — budgetStatus + legacyResponsibleRaw + isActive ของ responsible map
 * รันกับ Postgres จริง — ข้อมูลสมมติล้วน (prefix it-budget) ลบหมดใน afterAll
 */

const RUN = Date.now();
const OPERATOR_EMAIL = `it-budget-op-${RUN}@placeholder.local`;
const SUBMITTER_NAME = `it-budget-ผู้ทดสอบ-${RUN}`;
const CAT_SLUG = `it-budget-cat-${RUN}`;
const DEPT_SLUG = `it-budget-dept-${RUN}`;
const RAW_NULL = `it-budget-raw-null-${RUN}`;
const RAW_INACTIVE = `it-budget-raw-inactive-${RUN}`;
const RAW_OK = `it-budget-raw-ok-${RUN}`;

const SOURCES = [`it-budget-src-a-${RUN}`, `it-budget-src-b-${RUN}`, `it-budget-src-c-${RUN}`, `it-budget-src-d-${RUN}`];

let operatorId = '';
let categoryId = '';
let departmentId = '';
const createdCaseIds: string[] = [];

function manifestFor(source: string): string {
  return JSON.stringify({
    source_sha256: source,
    master_sha256: `it-budget-master-${RUN}`,
    write_gate: 'blocked',
    db_ready: 0,
    output_sha256: { 'rows.jsonl': 'h1', 'review-queue.jsonl': 'h2', 'summary.json': 'h3', 'ownership.json': 'h4' },
  });
}

function rowLine(key: string, row: number, rawResponsible: string, statusValue: string): string {
  return JSON.stringify({
    source: { workbook_sha256: SOURCES[0], sheet: 'DATA', row },
    source_key: key,
    original: {
      B: { type: 'string', value: `R${row}` },
      D: { type: 'string', value: 'walk-in' },
      E: { type: 'string', value: SUBMITTER_NAME },
      F: { type: 'string', value: 'บ้านทดสอบ หมู่ที่ 9' },
      H: { type: 'string', value: 'ไฟดับ' },
      I: { type: 'string', value: rawResponsible },
      J: { type: 'string', value: 'ดำเนินการแล้วเสร็จ' },
      K: { type: 'string', value: '' },
    },
    received_date: '2026-03-10',
    fiscal_year_be: 2569,
    category: { review_state: 'proposed', value: CAT_SLUG, id: categoryId },
    status: { review_state: 'proposed', value: statusValue },
    responsible: { raw: { type: 'string', value: rawResponsible }, review_state: 'unresolved' },
    review_codes: ['responsible_mapping_unresolved', 'submitter_identity_unresolved'],
    write_gate: 'blocked',
  });
}

function queueLine(source: string, key: string, row: number, codes: string[]): string {
  // § source ใน queue ไม่ถูกใช้ตัดสิน — ใส่ให้ครบโครงเฉย ๆ
  void source;
  return JSON.stringify({
    source_key: key,
    source: { workbook_sha256: SOURCES[0], sheet: 'DATA', row },
    codes,
    write_gate: 'blocked',
  });
}

function only<T>(arr: readonly T[]): T {
  if (arr.length !== 1) throw new Error(`expected exactly one, got ${arr.length}`);
  const item = arr[0];
  if (item === undefined) throw new Error('expected item');
  return item;
}

beforeAll(async () => {
  const db = await getDb();
  operatorId = generateId();
  await db.insert(users).values({
    id: operatorId,
    email: OPERATOR_EMAIL,
    role: 'officer',
    isActive: true,
    fullName: 'โอเปอเรเตอร์ทดสอบงบประมาณ',
  });
  departmentId = generateId();
  await db.insert(departments).values({ id: departmentId, name: `หน่วยทดสอบงบ ${RUN}`, slug: DEPT_SLUG });
  categoryId = generateId();
  await db.insert(categories).values({
    id: categoryId,
    name: `หมวดทดสอบงบ ${RUN}`,
    slug: CAT_SLUG,
    defaultDepartmentId: departmentId,
  });
  await db.insert(legacyResponsibleMap).values([
    { raw: RAW_NULL, departmentId: null, assignedTo: null, decidedBy: operatorId, isActive: true },
    { raw: RAW_INACTIVE, departmentId, assignedTo: null, decidedBy: operatorId, isActive: false },
    { raw: RAW_OK, departmentId, assignedTo: null, decidedBy: operatorId, isActive: true },
  ]);
});

afterAll(async () => {
  const db = await getDb();
  if (createdCaseIds.length) {
    await db.delete(caseUpdates).where(inArray(caseUpdates.caseId, createdCaseIds));
    await db.delete(auditLogs).where(inArray(auditLogs.resourceId, createdCaseIds));
  }
  const caseRows = createdCaseIds.length
    ? await db.select({ submittedBy: cases.submittedBy }).from(cases).where(inArray(cases.id, createdCaseIds))
    : [];
  if (createdCaseIds.length) await db.delete(cases).where(inArray(cases.id, createdCaseIds));
  await db.delete(importBatches).where(inArray(importBatches.sourceSha256, SOURCES));
  await db.delete(legacyResponsibleMap).where(inArray(legacyResponsibleMap.raw, [RAW_NULL, RAW_INACTIVE, RAW_OK]));
  await db.delete(categories).where(inArray(categories.id, [categoryId]));
  await db.delete(departments).where(inArray(departments.id, [departmentId]));
  const submitterIds = [...new Set(caseRows.map((r) => r.submittedBy))];
  if (submitterIds.length) {
    const consentRows = await db
      .select({ id: consentRecords.id })
      .from(consentRecords)
      .where(inArray(consentRecords.userId, submitterIds));
    expect(consentRows).toEqual([]);
  }
  await db.delete(users).where(inArray(users.id, [operatorId, ...submitterIds]));
  await closeDb();
});

describe('slice A · dry-run กับ map ที่ยังไม่ตัดสิน', () => {
  test('null dept ผ่านตามนโยบายใช้ค่าดิบ (inactive เท่านั้นที่ค้าง) และไม่เขียนอะไรเลย', async () => {
    const bundle = parseBundle(
      manifestFor(SOURCES[0]!),
      `${queueLine(SOURCES[0]!, 'it-budget-key-null', 4, ['responsible_mapping_unresolved', 'submitter_identity_unresolved'])}\n` +
        `${queueLine(SOURCES[0]!, 'it-budget-key-inactive', 5, ['responsible_mapping_unresolved', 'submitter_identity_unresolved'])}\n`,
      `${rowLine('it-budget-key-null', 4, RAW_NULL, 'done')}\n${rowLine('it-budget-key-inactive', 5, RAW_INACTIVE, 'done')}\n`,
    );
    const classified = classifyRows(bundle, { statusByKey: {}, dateByKey: {}, categoryByKey: {} });
    const report = await dryRun(bundle, classified);
    expect(report.records).toBe(2);
    expect(report.importable).toBe(1);
    expect(report.blocked).toBe(1);
    expect(report.batchExists).toBe(false);
    expect(report.blocks).toHaveLength(1);
    expect(only(report.blocks).sourceKey).toBe('it-budget-key-inactive');
    expect(only(report.blocks).codes).toContain('responsible_mapping_unresolved');

    // § dry-run อ่านอย่างเดียว — ต้องไม่มี batch row เกิดขึ้น
    const db = await getDb();
    const batchRows = await db
      .select({ id: importBatches.id })
      .from(importBatches)
      .where(eq(importBatches.sourceSha256, SOURCES[0]!));
    expect(batchRows).toEqual([]);
  });
});

describe('slice A · apply เขียน budgetStatus + legacyResponsibleRaw', () => {
  test('awaiting_budget → รองบ นอกนั้น → ไม่ระบุ พร้อมเก็บค่าดิบผู้รับผิดชอบ', async () => {
    const bundle = parseBundle(
      manifestFor(SOURCES[1]!),
      `${queueLine(SOURCES[1]!, 'it-budget-key-wait', 6, ['responsible_mapping_unresolved', 'submitter_identity_unresolved'])}\n` +
        `${queueLine(SOURCES[1]!, 'it-budget-key-done', 7, ['responsible_mapping_unresolved', 'submitter_identity_unresolved'])}\n`,
      `${rowLine('it-budget-key-wait', 6, RAW_OK, 'awaiting_budget')}\n${rowLine('it-budget-key-done', 7, RAW_OK, 'done')}\n`,
    );
    const classified = classifyRows(bundle, { statusByKey: {}, dateByKey: {}, categoryByKey: {} });
    const result = await applyImport({
      bundle,
      classified,
      operatorUserId: operatorId,
      sourceName: 'it-budget',
    });
    expect(result.imported).toBe(2);

    const db = await getDb();
    const rows = await db.select().from(cases).where(inArray(cases.sourceKey, ['it-budget-key-wait', 'it-budget-key-done']));
    expect(rows).toHaveLength(2);
    for (const row of rows) createdCaseIds.push(row.id);
    const byKey = new Map(rows.map((r) => [r.sourceKey, r]));
    expect(byKey.get('it-budget-key-wait')?.budgetStatus).toBe('awaiting_budget');
    expect(byKey.get('it-budget-key-done')?.budgetStatus).toBe('unspecified');
    for (const row of rows) {
      expect(row.legacyResponsibleRaw).toBe(RAW_OK);
      expect(row.isHistorical).toBe(true);
      expect(row.trackingCode).toBeNull();
    }
  });

  test('apply ปฏิเสธ map ที่ inactive (ไม่เขียนเคส แต่ batch row เกิดแล้ว — ลบใน afterAll)', async () => {
    const bundle = parseBundle(
      manifestFor(SOURCES[2]!),
      `${queueLine(SOURCES[2]!, 'it-budget-key-bad', 8, ['responsible_mapping_unresolved', 'submitter_identity_unresolved'])}\n`,
      `${rowLine('it-budget-key-bad', 8, RAW_INACTIVE, 'done')}\n`,
    );
    const classified = classifyRows(bundle, { statusByKey: {}, dateByKey: {}, categoryByKey: {} });
    await expect(
      applyImport({ bundle, classified, operatorUserId: operatorId, sourceName: 'it-budget' }),
    ).rejects.toThrow();
  });

  test('apply ยอม map ที่ active แต่ department ว่าง (เคสเข้าโดย department ว่าง)', async () => {
    const bundle = parseBundle(
      manifestFor(SOURCES[3]!),
      `${queueLine(SOURCES[3]!, 'it-budget-key-nulldept', 9, ['responsible_mapping_unresolved', 'submitter_identity_unresolved'])}\n`,
      `${rowLine('it-budget-key-nulldept', 9, RAW_NULL, 'done')}\n`,
    );
    const classified = classifyRows(bundle, { statusByKey: {}, dateByKey: {}, categoryByKey: {} });
    const result = await applyImport({
      bundle,
      classified,
      operatorUserId: operatorId,
      sourceName: 'it-budget',
    });
    expect(result.imported).toBe(1);

    const db = await getDb();
    const rows = await db.select().from(cases).where(eq(cases.sourceKey, 'it-budget-key-nulldept'));
    expect(rows).toHaveLength(1);
    for (const row of rows) createdCaseIds.push(row.id);
    expect(only(rows).departmentId).toBeNull();
    expect(only(rows).legacyResponsibleRaw).toBe(RAW_NULL);
  });
});

describe('slice A · schema default', () => {
  test('เคสใหม่ที่ไม่ระบุ budgetStatus ได้ unspecified', async () => {
    const db = await getDb();
    const id = generateId();
    await db.insert(cases).values({
      id,
      status: 'pending',
      title: 'ทดสอบ default งบประมาณ',
      description: 'integration test slice A',
      location: 'ตำบลหัวงัว',
      categoryId,
      submittedBy: operatorId,
    });
    createdCaseIds.push(id);
    const row = only(await db.select().from(cases).where(eq(cases.id, id)));
    expect(row.budgetStatus).toBe('unspecified');
  });
});
