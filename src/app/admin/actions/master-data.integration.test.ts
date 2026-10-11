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
import { auditLogs, categories, departments } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { deleteDepartment } from './master-data';

const RUN = Date.now();
const FREE_SLUG = `it-md-free-${RUN}`;
const USED_SLUG = `it-md-used-${RUN}`;
const CAT_SLUG = `it-md-cat-${RUN}`;

let freeId = '';
let usedId = '';

function form(id: string): FormData {
  const fd = new FormData();
  fd.set('id', id);
  return fd;
}

beforeAll(async () => {
  const db = await getDb();
  freeId = generateId();
  usedId = generateId();
  await db.insert(departments).values([
    { id: freeId, name: `หน่วยทดสอบว่าง ${RUN}`, slug: FREE_SLUG },
    { id: usedId, name: `หน่วยทดสอบใช้อยู่ ${RUN}`, slug: USED_SLUG },
  ]);
  await db.insert(categories).values({
    id: generateId(),
    name: `หมวดทดสอบอ้างหน่วย ${RUN}`,
    slug: CAT_SLUG,
    defaultDepartmentId: usedId,
  });
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(categories).where(eq(categories.slug, CAT_SLUG));
  await db.delete(auditLogs).where(eq(auditLogs.userId, mocks.actorId));
  await db.delete(departments).where(inArray(departments.slug, [FREE_SLUG, USED_SLUG]));
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
    expect(audits.some((a) => a.action === 'department_delete')).toBe(true);
  });

  test('ลบหน่วยงานที่มีหมวดอ้างถึงไม่ได้', async () => {
    const res = await deleteDepartment({ error: null }, form(usedId));
    expect(res.error).toContain('ปิดใช้งานแทน');

    const db = await getDb();
    const rows = await db.select().from(departments).where(eq(departments.id, usedId));
    expect(rows).toHaveLength(1);
  });
});
