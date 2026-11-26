import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, describe, expect, it, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { cases, caseStatsDaily } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { bangkokDateKey, statusCountsFromSnapshot, totalCasesFromSnapshot } from '@/lib/cases/stats';
import { GET } from './route';

/**
 * stats-refresh ต้องนับ "เรื่องทั้งหมด" ตามมาตรฐาน Excel COUNTA
 * (ไม่ใช่ count(status='received')) และเฉลี่ยวันปิดจากแถวที่มี closedAt จริง
 * ข้อมูลสมมติล้วน (prefix it-stats)
 */

const RUN = Date.now();

// § กันลบ snapshot ที่มีอยู่ก่อนหน้า (route ใช้ upsert ตามวัน → id เดิมอยู่รอด)
// ถ้า DB ไม่สะอาดให้หยุด suite แทนที่จะไปลบข้อมูลจริงตอน afterAll
async function assertCleanSnapshotTarget(db: Awaited<ReturnType<typeof getDb>>, date: string) {
  const existing = await db.select({ id: caseStatsDaily.id }).from(caseStatsDaily)
    .where(eq(caseStatsDaily.date, date)).limit(1);
  if (existing.length > 0) {
    throw new Error('stats-refresh integration: snapshot ของวันนี้มีอยู่แล้ว — ใช้ disposable test database');
  }
}

const createdCaseIds: string[] = [];
const createdSnapshotIds: string[] = [];
let createdSnapshotDate: string | null = null;

afterAll(async () => {
  const db = await getDb();
  if (createdCaseIds.length) {
    await db.delete(cases).where(inArray(cases.id, createdCaseIds));
  }
  if (createdSnapshotDate) {
    // § ลบเฉพาะ snapshot ของ fixture นี้ กันลบ snapshot จริงของวันนั้นบน DB shared
    await db.delete(caseStatsDaily).where(and(
      eq(caseStatsDaily.date, createdSnapshotDate),
      inArray(caseStatsDaily.id, createdSnapshotIds),
    ));
  }
  await closeDb();
});

describe('cron/stats-refresh · มาตรฐานสถานะ', () => {
  test('ยอดรายวันนับตามวันกรุงเทพ ไม่ใช่ UTC และแยก arrival/closure ตาม timestamp', async () => {
    const db = await getDb();
    const secret = process.env.CRON_SECRET;
    expect(secret && secret.length >= 16).toBe(true);

    const today = bangkokDateKey(new Date());
    const bangkokMidnightUtc = Date.parse(`${today}T00:00:00Z`) - 7 * 3600_000;
    const justAfterMidnight = new Date(bangkokMidnightUtc + 60 * 60_000);
    const justBeforeMidnight = new Date(bangkokMidnightUtc - 60 * 60_000);
    const arrivalId = generateId();
    const closureId = generateId();
    await db.insert(cases).values([
      {
        id: arrivalId,
        status: 'pending',
        title: `it-stats-arrival-${RUN}`,
        description: 'ข้อมูลสมมติ',
        location: '',
        categoryId: `it-stats-cat-${RUN}`,
        submittedBy: `it-stats-user-${RUN}`,
        createdAt: justAfterMidnight,
        updatedAt: justAfterMidnight,
      },
      {
        id: closureId,
        status: 'closed',
        title: `it-stats-closure-${RUN}`,
        description: 'ข้อมูลสมมติ',
        location: '',
        categoryId: `it-stats-cat-${RUN}`,
        submittedBy: `it-stats-user-${RUN}`,
        createdAt: justBeforeMidnight,
        updatedAt: justAfterMidnight,
        closedAt: justAfterMidnight,
      },
    ]);
    createdCaseIds.push(arrivalId, closureId);

    const expected = await db.execute<{ arrivals: number; closures: number }>(
      // § ใช้ขอบเขตเดียวกับ cron — 23:00 UTC ของวันก่อนหน้าคือ 06:00 น. ในกรุงเทพ
      sql`
        SELECT
          count(*) FILTER (WHERE created_at >= ${today}::date AT TIME ZONE 'Asia/Bangkok'
                             AND created_at < (${today}::date + 1) AT TIME ZONE 'Asia/Bangkok')::int AS arrivals,
          count(*) FILTER (WHERE closed_at >= ${today}::date AT TIME ZONE 'Asia/Bangkok'
                             AND closed_at < (${today}::date + 1) AT TIME ZONE 'Asia/Bangkok')::int AS closures
        FROM cases
      `,
    );
    const expectedRow = expected[0] as { arrivals: number; closures: number };
    await assertCleanSnapshotTarget(db, today);

    const res = await GET(
      new NextRequest('http://localhost/api/cron/stats-refresh', {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      stats: { dailyArrivals: number; dailyClosures: number; totalCases: number };
    };
    expect(body.stats.dailyArrivals).toBe(Number(expectedRow.arrivals));
    expect(body.stats.dailyClosures).toBe(Number(expectedRow.closures));

    const snapshotDate = bangkokDateKey(new Date());
    createdSnapshotDate = snapshotDate;
    const [snapshot] = await db.select().from(caseStatsDaily).where(eq(caseStatsDaily.date, snapshotDate));
    if (snapshot) createdSnapshotIds.push(snapshot.id);
    expect(snapshot?.totalReceived).toBe(body.stats.dailyArrivals);
    expect(snapshot?.totalClosed).toBe(body.stats.dailyClosures);
    expect(totalCasesFromSnapshot(snapshot!.metadata)).toBe(body.stats.totalCases);
    expect(statusCountsFromSnapshot(snapshot!.metadata)).not.toBeNull();
  });

  test(' refresh พร้อมกันสองครั้ง → upsert เดียว ไม่ unique violation', async () => {
    const db = await getDb();
    const secret = process.env.CRON_SECRET;
    expect(secret && secret.length >= 16).toBe(true);
    const req = () =>
      new NextRequest('http://localhost/api/cron/stats-refresh', {
        headers: { authorization: `Bearer ${secret}` },
      });

    const results = await Promise.allSettled([GET(req()), GET(req())]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    if (results[0]!.status === 'rejected') throw results[0]!.reason;
    if (results[1]!.status === 'rejected') throw results[1]!.reason;
    expect(results[0]!.value.status).toBe(200);
    expect(results[1]!.value.status).toBe(200);
    const snapshotDate = bangkokDateKey(new Date());
    const [snapshot] = await db.select().from(caseStatsDaily).where(eq(caseStatsDaily.date, snapshotDate));
    if (snapshot) createdSnapshotIds.push(snapshot.id);
    createdSnapshotDate = snapshotDate;
  });

  it('นับทุกสถานะเป็นยอดรับทั้งหมด และเฉลี่ยจากแถวที่มีวันปิด', async () => {
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
        categoryId: `it-stats-cat-${RUN}`,
        submittedBy: `it-stats-user-${RUN}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: closedId,
        status: 'closed',
        title: `it-stats closed ${RUN}`,
        description: 'ข้อมูลสมมติ',
        location: '',
        categoryId: `it-stats-cat-${RUN}`,
        submittedBy: `it-stats-user-${RUN}`,
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
      stats: { totalCases: number; totalReceived: number; totalClosed: number; totalInProgress: number; avgResolutionDays: number | null };
    };

    const closedRows = await db
      .select({ createdAt: cases.createdAt, closedAt: cases.closedAt })
      .from(cases)
      .where(eq(cases.status, 'closed'));
    const durations = closedRows
      .filter((row) => row.closedAt !== null)
      .map((row) => Math.floor((new Date(row.closedAt!).getTime() - new Date(row.createdAt).getTime()) / 86400000));
    const expectedAvg = durations.length
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : null;

    const [actual] = await db.select({ c: count() }).from(cases);
    expect(body.stats.totalCases).toBe(Number(actual?.c ?? 0));
    expect(body.stats.totalCases).toBeGreaterThanOrEqual(baseline + 2);
    expect(body.stats.totalReceived).toBeGreaterThanOrEqual(0);
    expect(body.stats.totalInProgress).toBeGreaterThanOrEqual(1);
    expect(body.stats.totalClosed).toBeGreaterThanOrEqual(1);
    expect(body.stats.avgResolutionDays).toBe(expectedAvg);

    // § route เขียนวันตามกรุงเทพ — อ่านด้วยเขตเวลาเดียวกัน ไม่ใช้ UTC date
    const today = bangkokDateKey(new Date());
    const [snapshot] = await db.select().from(caseStatsDaily).where(eq(caseStatsDaily.date, today));
    expect(snapshot).toBeDefined();
    expect(totalCasesFromSnapshot(snapshot!.metadata)).toBe(body.stats.totalCases);
    if (snapshot) createdSnapshotIds.push(snapshot.id);
    createdSnapshotDate = today;
  });
});
