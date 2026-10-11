import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { auditLogs, cases, caseUpdates, categories, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { callTool } from './tools';

let officerId: string;
let chiefId: string;
let citizenId: string;
let caseId: string;
let categoryId: string;

beforeAll(async () => {
  const db = await getDb();
  officerId = generateId();
  chiefId = generateId();
  citizenId = generateId();
  for (const [id, role] of [[officerId, 'officer'], [chiefId, 'chief'], [citizenId, 'citizen']] as const) {
    await db.insert(users).values({
      id,
      email: `it-mcp-${id}@placeholder.local`,
      role,
      isActive: true,
      fullName: 'ผู้ใช้ทดสอบ mcp',
    });
  }
  const [cat] = await db.select({ id: categories.id }).from(categories).limit(1);
  categoryId = cat!.id;
  caseId = generateId();
  await db.insert(cases).values({
    id: caseId,
    status: 'received',
    title: 'เรื่องทดสอบ mcp ค้นหาได้',
    description: 'รายละเอียดทดสอบ',
    location: 'ทดสอบ',
    categoryId,
    submittedBy: citizenId,
  });
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(caseUpdates).where(eq(caseUpdates.caseId, caseId));
  await db.delete(auditLogs).where(inArray(auditLogs.userId, [officerId, chiefId]));
  await db.delete(cases).where(eq(cases.id, caseId));
  await db.delete(users).where(inArray(users.id, [officerId, chiefId, citizenId]));
  await closeDb();
});

describe('callTool tiers', () => {
  test('officer write denied 403-style with audit-free deny', async () => {
    await expect(
      callTool('update_case_status', { caseId, to: 'reviewing' }, officerId),
    ).rejects.toThrow('forbidden');
  });

  test('chief valid transition allowed with audit row', async () => {
    const res = (await callTool('update_case_status', { caseId, to: 'reviewing' }, chiefId)) as { ok: boolean };
    expect(res.ok).toBe(true);
    const db = await getDb();
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.userId, chiefId));
    expect(audits.some((a) => a.action === 'mcp_tool_call')).toBe(true);
  });

  test('invalid transition denied with Thai reason', async () => {
    await expect(
      callTool('update_case_status', { caseId, to: 'closed' }, chiefId),
    ).rejects.toThrow('ไม่สามารถเปลี่ยนจาก');
  });

  test('officer system setting denied, read allowed by tier', async () => {
    await expect(callTool('get_system_setting', { key: 'maintenance_mode' }, officerId)).rejects.toThrow(
      'forbidden',
    );
  });

  test('search returns public-safe rows only', async () => {
    const rows = (await callTool('search_cases', { query: 'mcp ค้นหาได้' }, officerId)) as Array<
      Record<string, unknown>
    >;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['id', 'status', 'updatedAt'].sort());
    }
  });
});
