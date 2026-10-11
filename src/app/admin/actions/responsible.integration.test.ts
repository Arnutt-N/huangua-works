import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

/**
 * Responsible admin — server actions + ผลจริงต่อ dry-run
 * รันกับ Postgres จริง — ข้อมูลสมมติล้วน (prefix it-resp) ลบหมดใน afterAll
 */

const mocks = vi.hoisted(() => ({
  actorId: 'it-resp-actor',
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn(async () => ({
    user: { id: mocks.actorId, role: 'superadmin' },
    ipAddress: '127.0.0.1',
    userAgent: undefined,
  })),
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { closeDb, getDb } from '@/lib/db';
import { auditLogs, cases, caseUpdates, categories, departments, legacyResponsibleMap, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { classifyRows, dryRun, parseBundle } from '@/lib/import/legacy-import';
import { addResponsible, deleteResponsible, toggleResponsibleActive, updateResponsible } from './responsible';

const RUN = Date.now();
const DEPT_SLUG = `it-resp-dept-${RUN}`;
const DEPT2_SLUG = `it-resp-dept2-${RUN}`;
const CAT_SLUG = `it-resp-cat-${RUN}`;
const OFFICER_EMAIL = `it-resp-officer-${RUN}@placeholder.local`;
const RAW_A = `it-resp-raw-a-${RUN}`;
const SOURCE = `it-resp-src-${RUN}`;

let departmentId = '';
let department2Id = '';
let categoryId = '';
let officerId = '';
const createdCaseIds: string[] = [];

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function manifest(): string {
  return JSON.stringify({
    source_sha256: SOURCE,
    master_sha256: `it-resp-master-${RUN}`,
    write_gate: 'blocked',
    db_ready: 0,
    output_sha256: { 'rows.jsonl': 'h1', 'review-queue.jsonl': 'h2', 'summary.json': 'h3', 'ownership.json': 'h4' },
  });
}

function bundleFor(raw: string) {
  const key = `it-resp-key-${RUN}`;
  const rowsText = JSON.stringify({
    source: { workbook_sha256: SOURCE, sheet: 'DATA', row: 4 },
    source_key: key,
    original: {
      B: { type: 'string', value: 'R4' },
      D: { type: 'string', value: 'walk-in' },
      E: { type: 'string', value: `it-resp-ผู้ทดสอบ-${RUN}` },
      F: { type: 'string', value: 'บ้านทดสอบ หมู่ที่ 9' },
      H: { type: 'string', value: 'ไฟดับ' },
      I: { type: 'string', value: raw },
      J: { type: 'string', value: 'ดำเนินการแล้วเสร็จ' },
      K: { type: 'string', value: '' },
    },
    received_date: '2026-03-10',
    fiscal_year_be: 2569,
    category: { review_state: 'proposed', value: CAT_SLUG, id: categoryId },
    status: { review_state: 'proposed', value: 'done' },
    responsible: { raw: { type: 'string', value: raw }, review_state: 'unresolved' },
    review_codes: ['responsible_mapping_unresolved', 'submitter_identity_unresolved'],
    write_gate: 'blocked',
  });
  const queueText = JSON.stringify({
    source_key: key,
    source: { workbook_sha256: SOURCE, sheet: 'DATA', row: 4 },
    codes: ['responsible_mapping_unresolved', 'submitter_identity_unresolved'],
    write_gate: 'blocked',
  });
  return parseBundle(manifest(), `${queueText}\n`, `${rowsText}\n`);
}

async function getMap(raw: string) {
  const db = await getDb();
  const [row] = await db.select().from(legacyResponsibleMap).where(eq(legacyResponsibleMap.raw, raw));
  if (!row) throw new Error(`map ${raw} หาย`);
  return row;
}

beforeAll(async () => {
  const db = await getDb();
  departmentId = generateId();
  department2Id = generateId();
  await db.insert(departments).values([
    { id: departmentId, name: `หน่วยทดสอบ resp ${RUN}`, slug: DEPT_SLUG },
    { id: department2Id, name: `หน่วยทดสอบ resp2 ${RUN}`, slug: DEPT2_SLUG },
  ]);
  categoryId = generateId();
  await db.insert(categories).values({
    id: categoryId,
    name: `หมวดทดสอบ resp ${RUN}`,
    slug: CAT_SLUG,
    defaultDepartmentId: departmentId,
  });
  officerId = generateId();
  await db.insert(users).values({
    id: officerId,
    email: OFFICER_EMAIL,
    role: 'officer',
    isActive: true,
    fullName: 'เจ้าหน้าที่ทดสอบ resp',
  });
});

afterAll(async () => {
  const db = await getDb();
  if (createdCaseIds.length) {
    await db.delete(caseUpdates).where(inArray(caseUpdates.caseId, createdCaseIds));
    await db.delete(auditLogs).where(inArray(auditLogs.resourceId, createdCaseIds));
    await db.delete(cases).where(inArray(cases.id, createdCaseIds));
  }
  await db.delete(auditLogs).where(inArray(auditLogs.resourceId, [RAW_A]));
  await db.delete(legacyResponsibleMap).where(eq(legacyResponsibleMap.raw, RAW_A));
  await db.delete(categories).where(inArray(categories.id, [categoryId]));
  await db.delete(departments).where(inArray(departments.id, [departmentId, department2Id]));
  await db.delete(users).where(inArray(users.id, [officerId]));
  await closeDb();
});

describe('addResponsible / updateResponsible', () => {
  test('เพิ่ม mapping ใหม่ + audit', async () => {
    const result = await addResponsible(
      { error: null },
      form({ raw: RAW_A, departmentId, assignedTo: '__none__' }),
    );
    expect(result.error).toBeNull();

    const row = await getMap(RAW_A);
    expect(row.departmentId).toBe(departmentId);
    expect(row.assignedTo).toBeNull();
    expect(row.isActive).toBe(true);
    expect(row.decidedBy).toBe(mocks.actorId);

    const db = await getDb();
    const audits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resourceId, RAW_A), eq(auditLogs.action, 'responsible_create')));
    expect(audits.length).toBeGreaterThan(0);
  });

  test('ค่าดิบซ้ำ → ปฏิเสธ', async () => {
    const result = await addResponsible(
      { error: null },
      form({ raw: RAW_A, departmentId, assignedTo: '__none__' }),
    );
    expect(result.error).toContain('มีค่าดิบนี้');
  });

  test('หน่วยงานที่ไม่มี → ปฏิเสธ', async () => {
    const result = await addResponsible(
      { error: null },
      form({ raw: `it-resp-raw-x-${RUN}`, departmentId: 'no-such-dept', assignedTo: '__none__' }),
    );
    expect(result.error).toContain('ไม่พบหน่วยงาน');
  });

  test('แก้ไข mapping (เปลี่ยนหน่วยงาน + ผูกเจ้าหน้าที่)', async () => {
    const result = await updateResponsible(
      { error: null },
      form({ raw: RAW_A, departmentId: department2Id, assignedTo: officerId }),
    );
    expect(result.error).toBeNull();

    const row = await getMap(RAW_A);
    expect(row.departmentId).toBe(department2Id);
    expect(row.assignedTo).toBe(officerId);
  });
});

describe('toggleResponsibleActive กับ dry-run', () => {
  test('ปิด → แถวค้าง blocked เปิด → ผ่าน (ตัดสินจริง ไม่ใช่แค่ flag)', async () => {
    const active = bundleFor(RAW_A);
    const reportOn = await dryRun(active, classifyRows(active, { statusByKey: {}, dateByKey: {}, categoryByKey: {} }));
    expect(reportOn.importable).toBe(1);
    expect(reportOn.blocked).toBe(0);

    const off = await toggleResponsibleActive({ error: null }, form({ raw: RAW_A }));
    expect(off.error).toBeNull();
    expect((await getMap(RAW_A)).isActive).toBe(false);

    const blocked = bundleFor(RAW_A);
    const reportOff = await dryRun(blocked, classifyRows(blocked, { statusByKey: {}, dateByKey: {}, categoryByKey: {} }));
    expect(reportOff.importable).toBe(0);
    expect(reportOff.blocked).toBe(1);
    expect(reportOff.blocks[0]!.codes).toContain('responsible_mapping_unresolved');

    // § dry-run อ่านอย่างเดียว — ต้องไม่มี batch เกิดขึ้นทั้งสองรอบ
    const db = await getDb();
    expect(await db.select({ id: cases.id }).from(cases).where(eq(cases.sourceKey, `it-resp-key-${RUN}`))).toEqual([]);

    const on = await toggleResponsibleActive({ error: null }, form({ raw: RAW_A }));
    expect(on.error).toBeNull();
    expect((await getMap(RAW_A)).isActive).toBe(true);
  });
});

describe('deleteResponsible', () => {
  test('มีเรื่องย้อนหลังอ้างถึง → ปฏิเสธ ลบเรื่องแล้ว → ลบได้', async () => {
    const db = await getDb();
    const caseId = generateId();
    await db.insert(cases).values({
      id: caseId,
      status: 'done',
      title: 'it-เรื่องอ้าง responsible',
      description: 'รายละเอียดทดสอบ',
      location: 'ตำบลหัวงัว',
      categoryId,
      submittedBy: officerId,
      legacyResponsibleRaw: RAW_A,
      isHistorical: true,
    });

    const denied = await deleteResponsible({ error: null }, form({ raw: RAW_A }));
    expect(denied.error).toContain('ลบ mapping นี้ไม่ได้');
    expect((await getMap(RAW_A)).raw).toBe(RAW_A);

    await db.delete(cases).where(eq(cases.id, caseId));
    const ok = await deleteResponsible({ error: null }, form({ raw: RAW_A }));
    expect(ok.error).toBeNull();
    expect(await db.select().from(legacyResponsibleMap).where(eq(legacyResponsibleMap.raw, RAW_A))).toEqual([]);
  });
});
