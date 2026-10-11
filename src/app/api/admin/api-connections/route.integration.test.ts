import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { apiConnections, auditLogs, users } from '@/lib/db/schema';
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

import { GET, POST } from './route';

let adminId: string;

function postRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/admin/api-connections', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeAll(async () => {
  const db = await getDb();
  adminId = generateId();
  await db.insert(users).values({
    id: adminId,
    email: `it-conn-${adminId}@placeholder.local`,
    role: 'head',
    isActive: true,
    fullName: 'แอดมินทดสอบ connections',
  });
  mocks.currentUserId = adminId;
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(apiConnections).where(inArray(apiConnections.provider, ['smtp', 'line']));
  await db.delete(auditLogs).where(eq(auditLogs.userId, adminId));
  await db.delete(users).where(eq(users.id, adminId));
  await closeDb();
});

describe('POST /api/admin/api-connections', () => {
  test('refresh writes status row plus one audit row (no secret in response)', async () => {
    const res = await POST(postRequest({ provider: 'smtp' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      item: { provider: string; endpoint: string; status: string; lastCheckedAt: string | null };
    };
    expect(body.ok).toBe(true);
    expect(body.item.provider).toBe('smtp');
    expect(['unknown', 'connected', 'degraded', 'down']).toContain(body.item.status);
    expect(JSON.stringify(body)).not.toContain('SECRET');
    expect(JSON.stringify(body)).not.toContain('PASS');

    const db = await getDb();
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.userId, adminId));
    expect(audits.some((a) => a.action === 'api_connection_update')).toBe(true);
  });

  test('rejects unknown provider with 400', async () => {
    const res = await POST(postRequest({ provider: 'telegram' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/api-connections', () => {
  test('lists rows without secrets', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
    expect(JSON.stringify(body)).not.toContain('SECRET');
  });
});
