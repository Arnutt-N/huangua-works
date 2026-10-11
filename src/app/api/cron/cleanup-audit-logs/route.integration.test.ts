import { eq, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { GET } from './route';

const RUN = Date.now();
const ids = [`it-audit-old-${RUN}`, `it-audit-fresh-${RUN}`];

function reqWith(secret: string): NextRequest {
  return new NextRequest('http://localhost/api/cron/cleanup-audit-logs', {
    headers: { authorization: `Bearer ${secret}` },
  });
}

async function seed(): Promise<void> {
  const db = await getDb();
  const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
  await db.insert(auditLogs).values([
    { id: ids[0]!, action: 'test_old', resource: 'test', createdAt: old },
    { id: ids[1]!, action: 'test_fresh', resource: 'test' },
  ]);
}

afterAll(async () => {
  const db = await getDb();
  await db.delete(auditLogs).where(inArray(auditLogs.id, ids));
  await closeDb();
});

describe('GET /api/cron/cleanup-audit-logs', () => {
  test('deletes only rows older than retention and returns the count', async () => {
    await seed();
    const secret = process.env.CRON_SECRET ?? '';
    const res = await GET(reqWith(secret));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 1 });

    const db = await getDb();
    const remaining = await db.select({ id: auditLogs.id }).from(auditLogs).where(inArray(auditLogs.id, ids));
    expect(remaining.map((r) => r.id)).toEqual([ids[1]]);
  });

  test('wrong secret is rejected', async () => {
    const res = await GET(reqWith('wrong-secret'));
    expect(res.status).toBe(401);
  });
});
