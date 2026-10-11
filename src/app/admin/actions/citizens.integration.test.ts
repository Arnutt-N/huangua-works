import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

/**
 * Citizens admin — server actions + กติกามองเห็นหลังระงับบัญชี
 * รันกับ Postgres จริง — ข้อมูลสมมติล้วน (prefix it-citizen) ลบหมดใน afterAll
 * ห้ามพิมพ์ PII — assert ด้วย id/count/hash เท่านั้น
 */

const mocks = vi.hoisted(() => ({
  actorId: 'it-citizen-actor',
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
import { auditLogs, cases, caseUpdates, categories, consentRecords, lineUsers, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { generateCidHash } from '@/lib/cid-hmac';
import { findTrackableCase, listMyCases } from '@/lib/cases/citizen-access';
import {
  deleteCitizen,
  setCitizenCid,
  toggleCitizenActive,
  unlinkCitizenLine,
  updateCitizen,
} from './citizens';

const RUN = Date.now();
const SUFFIX = String(RUN).slice(-8).padStart(8, '0');
// § เลขบัตรทดสอบ checksum ถูกต้อง (ตรวจด้วย MOD 11 แล้ว) — ไม่ใช่เลขจริงของใคร
const CID_A = '1100700012343';
const CID_BAD = '1234567890123';
const CODE_T = `HG1${SUFFIX}`;
const LINE_OWNER = `U-it-citizen-${RUN}`;

const createdUserIds: string[] = [];
const createdCaseIds: string[] = [];
let lineRowId = '';
let categoryId = '';

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function createCitizen(name: string): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.insert(users).values({
    id,
    email: `it-citizen-${name}-${RUN}@placeholder.local`,
    role: 'citizen',
    isActive: true,
    fullName: `it-ทดสอบ ${name} ${RUN}`,
  });
  createdUserIds.push(id);
  return id;
}

async function getUser(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id));
  if (!row) throw new Error('user หาย');
  return row;
}

beforeAll(async () => {
  const db = await getDb();
  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน `npx tsx scripts/seed.ts` ก่อน');
  categoryId = category.id;
});

afterAll(async () => {
  const db = await getDb();
  if (createdCaseIds.length) {
    await db.delete(caseUpdates).where(inArray(caseUpdates.caseId, createdCaseIds));
    await db.delete(cases).where(inArray(cases.id, createdCaseIds));
  }
  if (lineRowId) await db.delete(lineUsers).where(eq(lineUsers.id, lineRowId));
  const resourceIds = [...createdUserIds, ...createdCaseIds];
  if (resourceIds.length) {
    await db.delete(auditLogs).where(inArray(auditLogs.resourceId, resourceIds));
  }
  if (createdUserIds.length) {
    await db.delete(consentRecords).where(inArray(consentRecords.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await closeDb();
});

describe('updateCitizen', () => {
  test('แก้ชื่อ/เบอร์/อีเมลติดต่อ (contactEmail ลง metadata ไม่แตะ identity email)', async () => {
    const id = await createCitizen('edit');
    const before = await getUser(id);

    const result = await updateCitizen(
      { error: null },
      form({ userId: id, fullName: 'it-ชื่อใหม่', phoneNumber: '0812345678', contactEmail: 'IT-Contact@Example.COM' }),
    );
    expect(result.error).toBeNull();

    const after = await getUser(id);
    expect(after.fullName).toBe('it-ชื่อใหม่');
    expect(after.phoneNumber).toBe('0812345678');
    expect(after.email).toBe(before.email);
    expect((after.metadata as { contactEmail?: string }).contactEmail).toBe('it-contact@example.com');

    const db = await getDb();
    const audits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resourceId, id), eq(auditLogs.action, 'citizen_update')));
    expect(audits.length).toBeGreaterThan(0);
  });

  test('ปฏิเสธบัญชีที่ไม่ใช่ citizen', async () => {
    const db = await getDb();
    const staffId = generateId();
    await db.insert(users).values({
      id: staffId,
      email: `it-citizen-staff-${RUN}@placeholder.local`,
      role: 'officer',
      isActive: true,
      fullName: 'เจ้าหน้าที่ทดสอบ',
    });
    createdUserIds.push(staffId);

    const result = await updateCitizen(
      { error: null },
      form({ userId: staffId, fullName: 'it-ชื่อใหม่', phoneNumber: '', contactEmail: '' }),
    );
    expect(result.error).toContain('ไม่ใช่บัญชีประชาชน');
  });
});

describe('toggleCitizenActive กับกติกามองเห็น', () => {
  test('ปิด → หายจากเว็บ/บอท/เรื่องของฉัน เปิด → กลับมาโดยไม่ต้องยินยอมใหม่', async () => {
    const db = await getDb();
    const id = await createCitizen('toggle');
    await db.insert(consentRecords).values({
      id: generateId(),
      userId: id,
      consentType: 'data_collection',
      version: '1.1',
      isGranted: true,
      grantedAt: new Date(),
    });
    const caseId = generateId();
    await db.insert(cases).values({
      id: caseId,
      status: 'received',
      title: 'it-เรื่องทดสอบการระงับ',
      description: 'รายละเอียดทดสอบ',
      location: 'ตำบลหัวงัว',
      categoryId,
      submittedBy: id,
      trackingCode: CODE_T,
    });
    createdCaseIds.push(caseId);
    lineRowId = generateId();
    await db.insert(lineUsers).values({ id: lineRowId, lineUserId: LINE_OWNER, linkedUserId: id });

    expect(await findTrackableCase(CODE_T, { channel: 'web' })).not.toBeNull();
    expect(await listMyCases(LINE_OWNER)).toHaveLength(1);

    const off = await toggleCitizenActive({ error: null }, form({ userId: id }));
    expect(off.error).toBeNull();
    expect((await getUser(id)).isActive).toBe(false);
    expect(await findTrackableCase(CODE_T, { channel: 'web' })).toBeNull();
    expect(await findTrackableCase(CODE_T, { channel: 'line_bot' })).toBeNull();
    expect(await listMyCases(LINE_OWNER)).toEqual([]);

    const on = await toggleCitizenActive({ error: null }, form({ userId: id }));
    expect(on.error).toBeNull();
    expect(await findTrackableCase(CODE_T, { channel: 'web' })).not.toBeNull();
    expect(await listMyCases(LINE_OWNER)).toHaveLength(1);
  });
});

describe('setCitizenCid', () => {
  test('เลขถูกต้อง → re-key email เป็น cid placeholder + audit ไม่มีเลขดิบ', async () => {
    const id = await createCitizen('cid');
    const result = await setCitizenCid({ error: null }, form({ userId: id, cid: CID_A }));
    expect(result.error).toBeNull();

    const expected = `cid-${generateCidHash(CID_A)}@placeholder.local`;
    expect((await getUser(id)).email).toBe(expected);

    const db = await getDb();
    const audits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resourceId, id), eq(auditLogs.action, 'citizen_set_cid')));
    expect(audits.length).toBeGreaterThan(0);
    expect(JSON.stringify(audits[0]!.metadata)).not.toContain(CID_A);
  });

  test('เลขชนกับบัญชีอื่น → ปฏิเสธ ไม่รวมบัญชี (email เดิมไม่เปลี่ยน)', async () => {
    const other = await createCitizen('cid-other');
    const before = await getUser(other);
    const result = await setCitizenCid({ error: null }, form({ userId: other, cid: CID_A }));
    expect(result.error).toContain('บัญชีอื่น');
    expect((await getUser(other)).email).toBe(before.email);
  });

  test('checksum ผิด → ปฏิเสธ', async () => {
    const id = await createCitizen('cid-bad');
    const result = await setCitizenCid({ error: null }, form({ userId: id, cid: CID_BAD }));
    expect(result.error).toContain('ไม่ถูกต้อง');
  });
});

describe('unlinkCitizenLine', () => {
  test('ถอดผูก LINE — linkedUserId เป็น null', async () => {
    const db = await getDb();
    const id = await createCitizen('unlink');
    const rowId = generateId();
    await db.insert(lineUsers).values({ id: rowId, lineUserId: `U-it-citizen-unlink-${RUN}`, linkedUserId: id });

    const result = await unlinkCitizenLine({ error: null }, form({ userId: id }));
    expect(result.error).toBeNull();

    const [row] = await db.select().from(lineUsers).where(eq(lineUsers.id, rowId));
    expect(row?.linkedUserId).toBeNull();
    await db.delete(lineUsers).where(eq(lineUsers.id, rowId));
  });
});

describe('deleteCitizen', () => {
  test('มีเรื่องอ้างถึง → ปฏิเสธ (บัญชีอยู่ครบ)', async () => {
    const db = await getDb();
    const id = await createCitizen('nodelete');
    const caseId = generateId();
    await db.insert(cases).values({
      id: caseId,
      status: 'received',
      title: 'it-เรื่องกันลบ',
      description: 'รายละเอียดทดสอบ',
      location: 'ตำบลหัวงัว',
      categoryId,
      submittedBy: id,
      trackingCode: `HG2${SUFFIX}`,
    });
    createdCaseIds.push(caseId);

    const result = await deleteCitizen({ error: null }, form({ userId: id }));
    expect(result.error).toContain('ลบบัญชีนี้ไม่ได้');
    expect((await getUser(id)).id).toBe(id);
  });

  test('ไม่มีเรื่องอ้างถึง → ลบ user + consent พร้อมกัน', async () => {
    const db = await getDb();
    const id = await createCitizen('delete');
    await db.insert(consentRecords).values({
      id: generateId(),
      userId: id,
      consentType: 'data_collection',
      version: '1.1',
      isGranted: true,
      grantedAt: new Date(),
    });

    const result = await deleteCitizen({ error: null }, form({ userId: id }));
    expect(result.error).toBeNull();

    expect(await db.select().from(users).where(eq(users.id, id))).toEqual([]);
    expect(await db.select().from(consentRecords).where(eq(consentRecords.userId, id))).toEqual([]);
    createdUserIds.splice(createdUserIds.indexOf(id), 1);
  });
});
