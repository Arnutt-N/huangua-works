import { count, eq, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { cases, caseStatsDaily } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { GET } from './route';

/**
 * stats-refresh ต้องนับ "เรื่องทั้งหมด" ตามมาตรฐาน Excel COUNTA
 * (ไม่ใช่ count(status='received')) และเฉลี่ยวันปิดจากแถวที่มี closedAt จริง
 * ข้อมูลสมมติล้วน (prefix it-stats)
 */

const RUN = Date.now();
const createdCaseIds: string[] = [];

afterAll(async () => {
  const db = await getDb();
  if (createdCaseIds.length) {
    await db.delete(cases).where(inArray(cases.id, createdCaseIds));
  }
  await closeDb();
});

describe('cron/stats-refresh · มาตรฐานสถานะ', () => {
  test('นับทุกสถานะเป็นยอดรับทั้งหมด และเฉลี่ยจากแถวที่มีวันปิด', async () => {
    const db = await getDb();
    const [before] = await db.select({ c: count() }).from(cases);
    const baseline = Number(before?.c ?? 0);

    const newId = generateId();
    const closedId = generateId();
    const closedAt = new Date();
    const createdAt = new Date(closedAt.getTime() - 2 * 86400000);
    await db.insert(cases).values([
      {
        id: newId,
        status: 'pending',
        title: `it-stats pending ${RUN}`,
        description: 'ข้อมูลสมมติ',
        location: '',
        categoryId: 'it-stats-cat',
        submittedBy: 'it-stats-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: closedId,
        status: 'closed',
        title: `it-stats closed ${RUN}`,
        description: 'ข้อมูลสมมติ',
        location: '',
        categoryId: 'it-stats-cat',
        submittedBy: 'it-stats-user',
        createdAt,
        updatedAt: closedAt,
        closedAt,
      },
    ]);
    createdCaseIds.push(newId, closedId);

    const secret = process.env.CRON_SECRET;
    expect(secret && secret.length >= 16).toBe(true);
    const res = await GET(
      new NextRequest('http://localhost/api/cron/stats-refresh', {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      stats: { totalReceived: number; totalClosed: number; totalInProgress: number };
    };

    const [actual] = await db.select({ c: count() }).from(cases);
    expect(body.stats.totalReceived).toBe(Number(actual?.c ?? 0));
    expect(body.stats.totalReceived).toBeGreaterThanOrEqual(baseline + 2);
    expect(body.stats.totalInProgress).toBeGreaterThanOrEqual(1);
    expect(body.stats.totalClosed).toBeGreaterThanOrEqual(1);

    const [after] = await db.select({ c: count() }).from(caseStatsDaily);
    expect(Number(after?.c ?? 0)).toBeGreaterThan(0);
  });
});
