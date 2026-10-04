import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Integration test — ต้องมี local Postgres รันอยู่
 * พิสูจน์ว่า action จัดการผู้ใช้ไม่ทิ้งการเปลี่ยนแปลงไว้เมื่อ audit ล้ม
 * (เดิม: update commit แล้ว → audit ล้ม → หน้าจอบอก error ทั้งที่ข้อมูลเปลี่ยนแล้ว)
 */
const mocks = vi.hoisted(() => ({
  failNextAudit: false,
  actorId: 'it-users-actor',
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return {
    ...actual,
    logAudit: vi.fn(async (...args: Parameters<typeof actual.logAudit>) => {
      if (mocks.failNextAudit) {
        mocks.failNextAudit = false;
        throw new Error('audit insert failed (forced)');
      }
      return actual.logAudit(...args);
    }),
  };
});

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn(async () => ({
    user: { id: mocks.actorId, role: 'superadmin' },
    ipAddress: '127.0.0.1',
    userAgent: undefined,
  })),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { closeDb, getDb } from '@/lib/db';
import { auditLogs, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { createUser, resetPassword, toggleUserActive, updateUserRole } from './users';

const RUN = Date.now();
let targetId: string;
const newUserEmail = `it-users-create-${RUN}@placeholder.local`;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function getTarget() {
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.id, targetId));
  if (!row) throw new Error('target user หาย');
  return row;
}

beforeAll(async () => {
  const db = await getDb();
  targetId = generateId();
  await db.insert(users).values({
    id: targetId,
    email: `it-users-target-${RUN}@placeholder.local`,
    role: 'officer',
    isActive: true,
    fullName: 'เจ้าหน้าที่ ทดสอบ',
  });
});

beforeEach(() => {
  mocks.failNextAudit = false;
  mocks.redirect.mockClear();
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(auditLogs).where(eq(auditLogs.resourceId, targetId));
  await db.delete(users).where(inArray(users.email, [newUserEmail]));
  await db.delete(users).where(eq(users.id, targetId));
  await closeDb();
});

describe('users actions · audit ล้มต้อง rollback', () => {
  test('toggleUserActive', async () => {
    mocks.failNextAudit = true;
    const result = await toggleUserActive({ error: null }, form({ userId: targetId }));

    expect(result).toEqual({ error: 'เกิดข้อผิดพลาดในการอัปเดต' });
    expect((await getTarget()).isActive).toBe(true);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  test('updateUserRole', async () => {
    mocks.failNextAudit = true;
    const result = await updateUserRole({ error: null }, form({ userId: targetId, role: 'chief' }));

    expect(result).toEqual({ error: 'เกิดข้อผิดพลาดในการอัปเดต' });
    expect((await getTarget()).role).toBe('officer');
  });

  test('resetPassword', async () => {
    mocks.failNextAudit = true;
    const before = (await getTarget()).passwordHash;
    const result = await resetPassword({ error: null }, form({ userId: targetId, newPassword: 'NewPassw0rd!' }));

    expect(result).toEqual({ error: 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน' });
    expect((await getTarget()).passwordHash).toBe(before);
  });

  test('createUser', async () => {
    mocks.failNextAudit = true;
    const result = await createUser(
      { error: null },
      form({ email: newUserEmail, fullName: 'ผู้ใช้ ใหม่', role: 'officer', password: 'Passw0rd!x' }),
    );

    expect(result).toEqual({ error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' });
    const db = await getDb();
    expect(await db.select().from(users).where(eq(users.email, newUserEmail))).toHaveLength(0);
  });
});

describe('users actions · สำเร็จยังทำงานเหมือนเดิม', () => {
  test('toggleUserActive เปลี่ยนสถานะ + audit + redirect', async () => {
    await toggleUserActive({ error: null }, form({ userId: targetId }));

    expect((await getTarget()).isActive).toBe(false);
    expect(mocks.redirect).toHaveBeenCalledWith('/admin/users?ok=toggled');
    const db = await getDb();
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, targetId));
    expect(audits.map((a) => a.action)).toEqual(['deactivate_user']);
  });
});
