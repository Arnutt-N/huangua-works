import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { auditLogs, systemSettings, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

const mocks = vi.hoisted(() => ({ currentUserId: '' }));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: {
      user: { id: mocks.currentUserId },
      ipAddress: '127.0.0.1',
      userAgent: undefined,
    },
  })),
}));

import { GET, PUT } from './route';

let adminId: string;

function putRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/admin/system-settings', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeAll(async () => {
  const db = await getDb();
  adminId = generateId();
  await db.insert(users).values({
    id: adminId,
    email: `it-sys-${adminId}@placeholder.local`,
    role: 'head',
    isActive: true,
    fullName: 'แอดมินทดสอบ settings',
  });
  mocks.currentUserId = adminId;
});

afterAll(async () => {
  const db = await getDb();
  // § ลบ key ที่ test เขียน การอ่านจะ fallback เป็น DEFAULTS ของ module เอง
  await db
    .delete(systemSettings)
    .where(inArray(systemSettings.key, ['maintenance_mode', 'audit_retention_days', 'import_default_org']));
  await db.delete(auditLogs).where(eq(auditLogs.userId, adminId));
  await db.delete(users).where(eq(users.id, adminId));
  await closeDb();
});

describe('GET /api/admin/system-settings', () => {
  test('returns the 3 allowlist keys', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      maintenance_mode: false,
      audit_retention_days: 365,
      import_default_org: 'huangua',
    });
  });
});

describe('PUT /api/admin/system-settings', () => {
  test('round-trips a valid patch and writes one audit row', async () => {
    const res = await PUT(putRequest({ maintenance_mode: true, audit_retention_days: 90 }));
    expect(res.status).toBe(200);

    const db = await getDb();
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, 'maintenance_mode'));
    expect(rows[0]?.value).toBe(true);
    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, adminId));
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(audits[audits.length - 1]?.action).toBe('system_setting_update');
  });

  test('rejects out-of-range retention with 400', async () => {
    const res = await PUT(putRequest({ audit_retention_days: 10 }));
    expect(res.status).toBe(400);
  });

  test('rejects empty patch with 400', async () => {
    const res = await PUT(putRequest({}));
    expect(res.status).toBe(400);
  });
});
