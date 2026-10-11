import { inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { auditLogs, cases, caseUpdates } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { GET } from './route';

/**
 * close-stale ข้ามเรื่อง historical — ข้อมูลสมมติล้วน (prefix it-stale)
 * เคส done เก่า isHistorical=false ถูกปิด ส่วน historical ค้าง done ต่อ
 */

const RUN = Date.now();
const createdCaseIds: string[] = [];

async function makeCase(isHistorical: boolean): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await db.insert(cases).values({
    id,
    status: 'done',
    title: `เรื่องทดสอบ stale ${RUN}`,
    description: 'ข้อมูลสมมติสำหรับทดสอบ cron',
    location: 'ไม่ระบุ',
    categoryId: `it-stale-cat-${RUN}`,
    submittedBy: `it-stale-user-${RUN}`,
    trackingCode: null,
    isHistorical,
    createdAt: old,
    updatedAt: old,
  });
  createdCaseIds.push(id);
  return id;
}

afterAll(async () => {
  const db = await getDb();
  if (createdCaseIds.length) {
    await db.delete(caseUpdates).where(inArray(caseUpdates.caseId, createdCaseIds));
    await db.delete(auditLogs).where(inArray(auditLogs.resourceId, createdCaseIds));
    await db.delete(cases).where(inArray(cases.id, createdCaseIds));
  }
  await closeDb();
});

describe('cron/close-stale · historical', () => {
  test('ปิดเฉพาะ done เก่าที่ไม่ใช่ historical', async () => {
    const historicalId = await makeCase(true);
    const normalId = await makeCase(false);

    const secret = process.env.CRON_SECRET;
    expect(secret && secret.length >= 16).toBe(true);
    const req = new NextRequest('http://localhost/api/cron/close-stale', {
      headers: { authorization: `Bearer ${secret}` },
    });
    const res = await GET(req);
    const body = (await res.json()) as { closedCount: number };
    expect(body.closedCount).toBeGreaterThanOrEqual(1);

    const db = await getDb();
    const rows = await db.select({ id: cases.id, status: cases.status }).from(cases).where(inArray(cases.id, [historicalId, normalId]));
    const byId = new Map(rows.map((r) => [r.id, r.status]));
    expect(byId.get(historicalId)).toBe('done');
    expect(byId.get(normalId)).toBe('closed');
  });
});
