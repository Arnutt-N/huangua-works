import { desc, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { auditLogs, cases, caseUpdates } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { applyCaseUpdate, checkPermission, SYSTEM_ACTOR, type CaseActor } from './operations';

/**
 * Integration test — ต้องมี local Postgres (`docker compose up -d`) รันอยู่จริง
 * ทดสอบผ่าน interface ของ operations module เท่านั้น (ไม่ mock db)
 */

const ACTOR: CaseActor = { userId: 'test-actor', role: 'officer', ipAddress: '203.0.113.1' };
const SUPERVISOR: CaseActor = { userId: 'test-supervisor', role: 'head' };

const createdCaseIds: string[] = [];

async function createTestCase(status: 'pending' | 'received' | 'in_progress' | 'done' = 'pending') {
  const db = await getDb();
  const id = generateId();
  await db.insert(cases).values({
    id,
    status,
    title: `ทดสอบ applyCaseUpdate ${id}`,
    description: 'integration test',
    location: 'ตำบลหัวงัว',
    categoryId: 'test-category',
    submittedBy: 'test-citizen',
  });
  createdCaseIds.push(id);
  return id;
}

async function getCase(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  if (!row) throw new Error(`case ${id} not found`);
  return row;
}

async function getTimeline(caseId: string) {
  const db = await getDb();
  return db
    .select()
    .from(caseUpdates)
    .where(eq(caseUpdates.caseId, caseId))
    .orderBy(desc(caseUpdates.createdAt));
}

beforeAll(async () => {
  await getDb();
});

afterAll(async () => {
  const db = await getDb();
  if (createdCaseIds.length > 0) {
    await db.delete(caseUpdates).where(inArray(caseUpdates.caseId, createdCaseIds));
    await db.delete(auditLogs).where(inArray(auditLogs.resourceId, createdCaseIds));
    await db.delete(cases).where(inArray(cases.id, createdCaseIds));
  }
  await closeDb();
});

describe('schema default', () => {
  test('a case inserted without explicit status starts at pending', async () => {
    const id = await createTestCase();
    const row = await getCase(id);
    expect(row.status).toBe('pending');
  });
});

describe('applyCaseUpdate — status', () => {
  test('valid transition pending → received updates case, timeline, and audit atomically', async () => {
    const id = await createTestCase('pending');

    const result = await applyCaseUpdate(
      id,
      { kind: 'status', newStatus: 'received', comment: 'รับเรื่อง', isPublic: true },
      ACTOR,
    );

    expect(result).toEqual({ ok: true });
    const row = await getCase(id);
    expect(row.status).toBe('received');
    expect(row.closedAt).toBeNull();

    const timeline = await getTimeline(id);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      updateType: 'status_change',
      oldValue: 'pending',
      newValue: 'received',
      userId: ACTOR.userId,
    });

    const db = await getDb();
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, id));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe('update_case_status');
  });

  test('invalid transition pending → done is rejected and writes nothing', async () => {
    const id = await createTestCase('pending');

    const result = await applyCaseUpdate(
      id,
      { kind: 'status', newStatus: 'done', isPublic: true },
      ACTOR,
    );

    expect(result.ok).toBe(false);
    expect((await getCase(id)).status).toBe('pending');
    expect(await getTimeline(id)).toHaveLength(0);
  });

  test('closing (done) sets closedAt; reopening (done → in_progress) clears it', async () => {
    const id = await createTestCase('in_progress');

    await applyCaseUpdate(id, { kind: 'status', newStatus: 'done', isPublic: true }, ACTOR);
    expect((await getCase(id)).closedAt).toBeInstanceOf(Date);

    await applyCaseUpdate(id, { kind: 'status', newStatus: 'in_progress', isPublic: true }, ACTOR);
    expect((await getCase(id)).closedAt).toBeNull();
  });

  test('SYSTEM_ACTOR can close a done case (cron path)', async () => {
    const id = await createTestCase('done');

    const result = await applyCaseUpdate(
      id,
      { kind: 'status', newStatus: 'closed', comment: 'ปิดเรื่องอัตโนมัติ (เกิน 7 วัน)', isPublic: true },
      SYSTEM_ACTOR,
    );

    expect(result).toEqual({ ok: true });
    const row = await getCase(id);
    expect(row.status).toBe('closed');
    expect(row.closedAt).toBeInstanceOf(Date);

    const timeline = await getTimeline(id);
    expect(timeline[0]).toMatchObject({ userId: 'system', newValue: 'closed' });
  });

  test('unknown case id returns ไม่พบเรื่องที่ระบุ', async () => {
    const result = await applyCaseUpdate(
      generateId(),
      { kind: 'status', newStatus: 'received', isPublic: true },
      ACTOR,
    );
    expect(result).toEqual({ ok: false, error: 'ไม่พบเรื่องที่ระบุ' });
  });
});

describe('applyCaseUpdate — permissions', () => {
  test('officer cannot change department', async () => {
    const id = await createTestCase('received');

    const result = await applyCaseUpdate(
      id,
      { kind: 'department', departmentId: 'dept-x' },
      ACTOR,
    );

    expect(result.ok).toBe(false);
    expect((await getCase(id)).departmentId).toBeNull();
    expect(await getTimeline(id)).toHaveLength(0);
  });

  test('supervisor (head) can change department', async () => {
    const id = await createTestCase('received');

    const result = await applyCaseUpdate(
      id,
      { kind: 'department', departmentId: 'dept-x' },
      SUPERVISOR,
    );

    expect(result).toEqual({ ok: true });
    expect((await getCase(id)).departmentId).toBe('dept-x');
    expect((await getTimeline(id))[0]?.updateType).toBe('metadata_change');
  });

  test('checkPermission matrix: only department is supervisor-gated', () => {
    expect(checkPermission('officer', { kind: 'status', newStatus: 'received', isPublic: true }).ok).toBe(true);
    expect(checkPermission('officer', { kind: 'assignment', officerId: null }).ok).toBe(true);
    expect(checkPermission('officer', { kind: 'priority', priority: 'urgent' }).ok).toBe(true);
    expect(checkPermission('officer', { kind: 'comment', comment: 'x', isPublic: false }).ok).toBe(true);
    expect(checkPermission('officer', { kind: 'department', departmentId: null }).ok).toBe(false);
    for (const role of ['chief', 'head', 'superadmin']) {
      expect(checkPermission(role, { kind: 'department', departmentId: null }).ok).toBe(true);
    }
  });
});

describe('applyCaseUpdate — priority and comment', () => {
  test('same priority is rejected without writes', async () => {
    const id = await createTestCase('received');

    const result = await applyCaseUpdate(id, { kind: 'priority', priority: 'normal' }, ACTOR);

    expect(result).toEqual({ ok: false, error: 'ความเร่งด่วนเหมือนเดิม' });
    expect(await getTimeline(id)).toHaveLength(0);
  });

  test('priority change writes case + timeline', async () => {
    const id = await createTestCase('received');

    const result = await applyCaseUpdate(id, { kind: 'priority', priority: 'urgent' }, ACTOR);

    expect(result).toEqual({ ok: true });
    expect((await getCase(id)).priority).toBe('urgent');
    expect((await getTimeline(id))[0]).toMatchObject({
      updateType: 'metadata_change',
      newValue: 'urgent',
    });
  });

  test('comment adds timeline entry without touching status', async () => {
    const id = await createTestCase('received');

    const result = await applyCaseUpdate(
      id,
      { kind: 'comment', comment: 'บันทึกภายใน', isPublic: false },
      ACTOR,
    );

    expect(result).toEqual({ ok: true });
    expect((await getCase(id)).status).toBe('received');
    const timeline = await getTimeline(id);
    expect(timeline[0]).toMatchObject({
      updateType: 'comment',
      comment: 'บันทึกภายใน',
      isPublic: false,
    });
  });
});
