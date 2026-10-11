import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

/**
 * Master-data delete — ลบหน่วยงานถาวรเฉพาะที่ไม่มีใครอ้างถึง
 * รันกับ Postgres จริง — ข้อมูลสมมติล้วน (prefix it-md) ลบหมดใน afterAll
 */

const mocks = vi.hoisted(() => ({
  actorId: 'it-md-actor',
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn(async () => ({
    user: { id: mocks.actorId, role: 'head' },
    ipAddress: '127.0.0.1',
    userAgent: undefined,
  })),
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { closeDb, getDb } from '@/lib/db';
import { auditLogs, cases, categories, departments, legacyResponsibleMap, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { deleteDepartment } from './master-data';

const RUN = Date.now();
const FREE_SLUG = `it-md-free-${RUN}`;
const USED_SLUG = `it-md-used-${RUN}`;
const USER_SLUG = `it-md-user-${RUN}`;
const CASE_SLUG = `it-md-case-${RUN}`;
const LEGACY_SLUG = `it-md-legacy-${RUN}`;
const CAT_SLUG = `it-md-cat-${RUN}`;
const USER_EMAIL = `it-md-user-${RUN}@example.com`;
const LEGACY_RAW = `it-md-raw-${RUN}`;

let freeId = '';
let usedId = '';
let userDeptId = '';
let caseDeptId = '';
let legacyDeptId = '';
let caseId = '';

function form(id: string): FormData {
  const fd = new FormData();
  fd.set('id', id);
  return fd;
}

beforeAll(async () => {
  const db = await getDb();
  freeId = generateId();
  usedId = generateId();
  userDeptId = generateId();
  caseDeptId = generateId();
  legacyDeptId = generateId();
  caseId = generateId();
  await db.insert(departments).values([
    { id: freeId, name: `หน่วยทดสอบว่าง ${RUN}`, slug: FREE_SLUG },
    { id: usedId, name: `หน่วยทดสอบใช้อยู่ ${RUN}`, slug: USED_SLUG },
    { id: userDeptId, name: `หน่วยทดสอบผู้ใช้ ${RUN}`, slug: USER_SLUG },
    { id: caseDeptId, name: `หน่วยทดสอบเรื่อง ${RUN}`, slug: CASE_SLUG },
    { id: legacyDeptId, name: `หน่วยทดสอบแมป ${RUN}`, slug: LEGACY_SLUG },
  ]);
  await db.insert(categories).values({
    id: generateId(),
    name: `หมวดทดสอบอ้างหน่วย ${RUN}`,
    slug: CAT_SLUG,
    defaultDepartmentId: usedId,
  });
  await db.insert(users).values({
    id: generateId(),
    email: USER_EMAIL,
    role: 'citizen',
    departmentId: userDeptId,
    fullName: `ผู้ทดสอบ ${RUN}`,
  });
  await db.insert(cases).values({
    id: caseId,
    title: `เรื่องทดสอบอ้างหน่วย ${RUN}`,
    description: 'integration test',
    location: 'ตำบลหัวงัว',
    categoryId: 'test-category',
    submittedBy: 'test-citizen',
    departmentId: caseDeptId,
  });
  await db.insert(legacyResponsibleMap).values({
    raw: LEGACY_RAW,
    departmentId: legacyDeptId,
    decidedBy: mocks.actorId,
  });
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(cases).where(eq(cases.id, caseId));
  await db.delete(users).where(eq(users.email, USER_EMAIL));
  await db.delete(legacyResponsibleMap).where(eq(legacyResponsibleMap.raw, LEGACY_RAW));
  await db.delete(auditLogs).where(eq(auditLogs.userId, mocks.actorId));
  await db.delete(departments).where(inArray(departments.slug, [FREE_SLUG, USED_SLUG, USER_SLUG, CASE_SLUG, LEGACY_SLUG]));
  await closeDb();
});

describe('deleteDepartment', () => {
  test('ลบหน่วยงานว่างได้พร้อม audit', async () => {
    const res = await deleteDepartment({ error: null }, form(freeId));
    expect(res.error).toBeNull();
    expect(res.success).toBe('ลบหน่วยงานแล้ว');

    const db = await getDb();
    const rows = await db.select().from(departments).where(eq(departments.id, freeId));
    expect(rows).toHaveLength(0);
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.userId, mocks.actorId));
    expect(audits.some((a) => a.action === 'department_delete' && a.resourceId === freeId)).toBe(true);
  });

  test('ลบหน่วยงานที่มีหมวดอ้างถึงไม่ได้', async () => {
    const res = await deleteDepartment({ error: null }, form(usedId));
    expect(res.error).toContain('ปิดใช้งานแทน');

    const db = await getDb();
    const rows = await db.select().from(departments).where(eq(departments.id, usedId));
    expect(rows).toHaveLength(1);
  });

  test('ลบหน่วยงานที่มีผู้ใช้อ้างถึงไม่ได้', async () => {
    const res = await deleteDepartment({ error: null }, form(userDeptId));
    expect(res.error).toContain('ปิดใช้งานแทน');

    const db = await getDb();
    const rows = await db.select().from(departments).where(eq(departments.id, userDeptId));
    expect(rows).toHaveLength(1);
  });

  test('ลบหน่วยงานที่มีเรื่องอ้างถึงไม่ได้', async () => {
    const res = await deleteDepartment({ error: null }, form(caseDeptId));
    expect(res.error).toContain('ปิดใช้งานแทน');

    const db = await getDb();
    const rows = await db.select().from(departments).where(eq(departments.id, caseDeptId));
    expect(rows).toHaveLength(1);
  });

  test('ลบหน่วยงานที่มีแมปเดิมอ้างถึงไม่ได้', async () => {
    const res = await deleteDepartment({ error: null }, form(legacyDeptId));
    expect(res.error).toContain('ปิดใช้งานแทน');

    const db = await getDb();
    const rows = await db.select().from(departments).where(eq(departments.id, legacyDeptId));
    expect(rows).toHaveLength(1);
  });

  test('ลบหน่วยงานที่ไม่มีอยู่ไม่ได้', async () => {
    const res = await deleteDepartment({ error: null }, form(generateId()));
    expect(res.error).toBe('ไม่พบหน่วยงานที่ระบุ');
  });
});
