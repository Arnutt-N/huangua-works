import { eq, inArray, or } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Integration test — ต้องมี local Postgres (`docker compose up -d postgres redis up-redis`)
 * พิสูจน์ว่า createCase เขียน users / consent_records / cases / dedup_hashes / audit_logs
 * แบบ all-or-nothing
 *
 * § บังคับ audit ล้มด้วย mock แบบ passthrough — ตารางไม่มี FK จริงจึงทำให้ insert
 * ล้มด้วยข้อมูลไม่ได้ ตัว mock เรียก logAudit ของจริงเสมอ ยกเว้นตอนสั่ง failNext
 */
const auditControl = vi.hoisted(() => ({ failNext: false }));

/**
 * § บังคับให้สอง createCase สุ่มเลขติดตามตัวเดียวกันใน integration test
 * แทนการแก้ RNG ฝั่งโค้ด — ใช้ resolve ภายนอกผ่าน hoisted state
 */
const trackingControl = vi.hoisted(() => ({ forcedQueue: [] as string[] }));

vi.mock('../case-tracking', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/case-tracking')>();
  return {
    ...actual,
    generateTrackingCode: vi.fn(() => trackingControl.forcedQueue.shift() ?? actual.generateTrackingCode()),
  };
});

vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return {
    ...actual,
    logAudit: vi.fn(async (...args: Parameters<typeof actual.logAudit>) => {
      if (auditControl.failNext) {
        auditControl.failNext = false;
        throw new Error('audit insert failed (forced)');
      }
      return actual.logAudit(...args);
    }),
  };
});

import { closeDb, getDb } from '@/lib/db';
import { auditLogs, cases, categories, consentRecords, dedupHashes, lineUsers, users } from '@/lib/db/schema';
import { generateCidHash, generateDedupHash } from '@/lib/cid-hmac';
import { generateId } from '@/lib/id';
import { lookupHash, pseudonymizeLineId } from '@/lib/line/identity';
import { createCase } from './intake';
import { findTrackableCase } from './citizen-access';

// CID ต่อรอบรัน (13 หลัก) — createCase ไม่ตรวจ checksum จึงใช้เลขสุ่มได้
const RUN = Date.now().toString().slice(-9);
const cidFor = (n: number) => `99${n}${RUN}`.slice(0, 13).padEnd(13, '0');
const cidEmail = (cid: string) => `cid-${generateCidHash(cid)}@placeholder.local`;

const createdCaseIds: string[] = [];
const createdEmails: string[] = [];
const LINE_NEW = `U-it-aw-new-${RUN}`;
const LINE_EXISTING = `U-it-aw-old-${RUN}`;
const LINE_RACE = `U-it-aw-race-${RUN}`;
let categoryId: string;

/** ลบของ fixture นี้แม้ฟังก์ชัน throw ก่อน push id — ไม่พึ่งผลสำเร็จ (C6-03) */
async function cleanupFixture(): Promise<void> {
  const db = await getDb();
  const titles = [
    `ทดสอบ rollback ผู้แจ้งใหม่ ${RUN}`,
    `ทดสอบ rollback ผู้แจ้งเดิม ${RUN}`,
    `ทดสอบ commit ครบ ${RUN}`,
    `ทดสอบ rollback line ใหม่ ${RUN}`,
    `ทดสอบ rollback line มีแถว ${RUN}`,
    // § c1 ต่อท้าย — fixture ความยินยอม/การมองเห็น (citizen-case-access)
    `บอท consent ${RUN}`,
    `LIFF consent ${RUN}`,
    `บอท ติดตามได้ ${RUN}`,
    `ทดสอบชนพร้อมกัน ${RUN}`,
    `ทดสอบชนเลขติดตาม A ${RUN}`,
    `ทดสอบชนเลขติดตาม B ${RUN}`,
    `ทดสอบ race LINE ${RUN}`,
  ];
  const leaked = await db.select({ id: cases.id }).from(cases).where(inArray(cases.title, titles));
  const caseIds = [...new Set([...createdCaseIds, ...leaked.map((r) => r.id)])];
  if (caseIds.length > 0) {
    await db.delete(auditLogs).where(inArray(auditLogs.resourceId, caseIds));
    await db.delete(dedupHashes).where(inArray(dedupHashes.caseId, caseIds));
    await db.delete(cases).where(inArray(cases.id, caseIds));
  }
  // § LINE_BOT/LINE_LIFF ของ c1 ประกาศท้ายไฟล์ — afterAll รันหลัง module โหลดครบจึงอ้างได้
  const rawIds = [LINE_NEW, LINE_EXISTING, LINE_BOT, LINE_LIFF, LINE_RACE];
  await db.delete(lineUsers).where(inArray(lineUsers.lineUserIdHash, rawIds.map(lookupHash)));
  const { linePlaceholderEmail } = await import('@/lib/line/placeholder-email');
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        inArray(users.email, createdEmails),
        ...rawIds.map((raw) => eq(users.email, linePlaceholderEmail(lookupHash(raw)))),
      ),
    );
  const userIds = userRows.map((u) => u.id);
  if (userIds.length > 0) {
    await db.delete(consentRecords).where(inArray(consentRecords.userId, userIds));
    await db.delete(auditLogs).where(inArray(auditLogs.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
}

beforeAll(async () => {
  const db = await getDb();
  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน `npx tsx scripts/seed.ts` ก่อน');
  categoryId = category.id;
});

beforeEach(() => {
  auditControl.failNext = false;
  trackingControl.forcedQueue = [];
});

afterAll(async () => {
  await cleanupFixture();
  await closeDb();
});

function webInput(cid: string, title: string) {
  return {
    channel: 'web' as const,
    title,
    description: `รายละเอียด ${title}`,
    categoryId,
    cid,
    fullName: 'ทดสอบ ธุรกรรม',
  };
}

describe('createCase · atomic (integration)', () => {
  test('audit ล้ม (ผู้แจ้งใหม่) → ไม่มี users / cases / dedup_hashes ค้าง', async () => {
    const cid = cidFor(1);
    const input = webInput(cid, `ทดสอบ rollback ผู้แจ้งใหม่ ${RUN}`);
    createdEmails.push(cidEmail(cid));
    auditControl.failNext = true;

    await expect(createCase(input)).rejects.toThrow('audit insert failed (forced)');

    const db = await getDb();
    expect(await db.select().from(cases).where(eq(cases.title, input.title))).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.email, cidEmail(cid)))).toHaveLength(0);
    const hash = generateDedupHash(cid, input.title, input.description);
    expect(await db.select().from(dedupHashes).where(eq(dedupHashes.hash, hash))).toHaveLength(0);
  });

  test('audit ล้ม (ผู้แจ้งเดิม) → ไม่มี consent_records ใหม่และไม่มีเรื่อง', async () => {
    const cid = cidFor(2);
    const db = await getDb();
    const existingUserId = generateId();
    await db.insert(users).values({
      id: existingUserId,
      email: cidEmail(cid),
      role: 'citizen',
      isActive: true,
      fullName: 'ผู้แจ้งเดิม',
    });
    createdEmails.push(cidEmail(cid));
    const input = webInput(cid, `ทดสอบ rollback ผู้แจ้งเดิม ${RUN}`);
    auditControl.failNext = true;

    await expect(createCase(input)).rejects.toThrow('audit insert failed (forced)');

    expect(
      await db.select().from(consentRecords).where(eq(consentRecords.userId, existingUserId)),
    ).toHaveLength(0);
    expect(await db.select().from(cases).where(eq(cases.submittedBy, existingUserId))).toHaveLength(0);
  });

  test('สำเร็จ → เขียนครบทั้ง 5 ตาราง', async () => {
    const cid = cidFor(3);
    const input = webInput(cid, `ทดสอบ commit ครบ ${RUN}`);
    createdEmails.push(cidEmail(cid));

    const result = await createCase(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdCaseIds.push(result.caseId);

    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.email, cidEmail(cid)));
    expect(user).toBeDefined();
    const [caseRow] = await db.select().from(cases).where(eq(cases.id, result.caseId));
    expect(caseRow?.submittedBy).toBe(user?.id);
    expect(
      await db.select().from(consentRecords).where(eq(consentRecords.userId, user!.id)),
    ).toHaveLength(1);
    expect(
      await db.select().from(dedupHashes).where(eq(dedupHashes.caseId, result.caseId)),
    ).toHaveLength(1);
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, result.caseId));
    expect(audits.map((a) => a.action)).toEqual(['submit_case']);
  });

  test('audit ล้ม (channel=line, ยังไม่มี line_users) → linkedUserId ไม่ค้าง และไม่มี users', async () => {
    auditControl.failNext = true;
    await expect(
      createCase({
        channel: 'line',
        lineUserId: LINE_NEW,
        categoryId,
        title: `ทดสอบ rollback line ใหม่ ${RUN}`,
        description: 'รายละเอียด line',
        location: 'ทดสอบ',
      }),
    ).rejects.toThrow('audit insert failed (forced)');

    const db = await getDb();
    expect(await db.select().from(lineUsers).where(eq(lineUsers.lineUserIdHash, lookupHash(LINE_NEW)))).toHaveLength(0);
    const { linePlaceholderEmail } = await import('@/lib/line/placeholder-email');
    expect(await db.select().from(users).where(eq(users.email, linePlaceholderEmail(lookupHash(LINE_NEW))))).toHaveLength(0);
  });

  test('audit ล้ม (channel=line, มี line_users แล้ว) → linkedUserId ไม่ถูกเขียนค้าง', async () => {
    const db = await getDb();
    const p = pseudonymizeLineId(LINE_EXISTING);
    await db.insert(lineUsers).values({
      id: generateId(),
      lineUserIdHash: p.hash,
      lineUserIdEnc: p.enc,
      lineUserIdHashV: p.v,
      linkedUserId: null,
    });
    auditControl.failNext = true;

    await expect(
      createCase({
        channel: 'line',
        lineUserId: LINE_EXISTING,
        categoryId,
        title: `ทดสอบ rollback line มีแถว ${RUN}`,
        description: 'รายละเอียด line',
        location: 'ทดสอบ',
      }),
    ).rejects.toThrow('audit insert failed (forced)');

    const [row] = await db.select().from(lineUsers).where(eq(lineUsers.lineUserIdHash, lookupHash(LINE_EXISTING)));
    expect(row?.linkedUserId ?? null).toBeNull();
  });
});

// ─── c1 ต่อท้าย: createCase × ความยินยอม (ไฟล์นี้ c6 เป็นเจ้าของโครง) ───
// ใช้ RUN/categoryId/afterAll เดิม — ทุกช่องทางต้องมี record data_collection ตั้งแต่ตอนแจ้ง
// (เดิมบอทไม่บันทึก → เรื่องจากบอท 404 บน /track)
const LINE_BOT = `U-it-intake-bot-${RUN}`;
const LINE_LIFF = `U-it-intake-liff-${RUN}`;
const consentCaseIds: string[] = [];
const consentSubmitterIds = new Set<string>();

async function submitterOf(caseId: string): Promise<string> {
  const db = await getDb();
  const [row] = await db
    .select({ submittedBy: cases.submittedBy })
    .from(cases)
    .where(eq(cases.id, caseId))
    .limit(1);
  if (!row) throw new Error(`ไม่พบเรื่อง ${caseId}`);
  consentSubmitterIds.add(row.submittedBy);
  return row.submittedBy;
}

async function grantedViasOf(userId: string): Promise<Array<string | undefined>> {
  const db = await getDb();
  const rows = await db.select().from(consentRecords).where(eq(consentRecords.userId, userId));
  return rows
    .filter((r) => r.isGranted && r.consentType === 'data_collection')
    .map((r) => (r.metadata as { via?: string } | null)?.via);
}

describe('createCase · บันทึกความยินยอมทุกช่องทาง', () => {
  test('แจ้งผ่านบอท LINE → บันทึก data_collection via line_bot_submit', async () => {
    const result = await createCase({
      channel: 'line',
      lineUserId: LINE_BOT,
      categoryId,
      title: `บอท consent ${RUN}`,
      description: 'รายละเอียดทดสอบช่องทางบอท',
      location: 'ทดสอบ ตำบลหัวงัว',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    consentCaseIds.push(result.caseId);
    expect(await grantedViasOf(await submitterOf(result.caseId))).toContain('line_bot_submit');
  });

  test('แจ้งผ่าน LIFF → ยังบันทึก via liff_submit ตามเดิม', async () => {
    const result = await createCase({
      channel: 'line',
      origin: 'liff',
      lineUserId: LINE_LIFF,
      categoryId,
      title: `LIFF consent ${RUN}`,
      description: 'รายละเอียดทดสอบช่องทาง LIFF',
      location: 'ทดสอบ ตำบลหัวงัว',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    consentCaseIds.push(result.caseId);
    expect(await grantedViasOf(await submitterOf(result.caseId))).toContain('liff_submit');
  });

  test('เรื่องที่แจ้งผ่านบอทติดตามได้ทันทีทั้งทางเว็บและทางบอท', async () => {
    const title = `บอท ติดตามได้ ${RUN}`;
    const result = await createCase({
      channel: 'line',
      lineUserId: LINE_BOT,
      categoryId,
      title,
      description: 'รายละเอียดทดสอบติดตามเรื่องจากบอท',
      location: 'ทดสอบ ตำบลหัวงัว',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    consentCaseIds.push(result.caseId);
    await submitterOf(result.caseId);

    expect((await findTrackableCase(result.trackingCode, { channel: 'web' }))?.case.title).toBe(title);
    expect(await findTrackableCase(result.trackingCode, { channel: 'line_bot' })).not.toBeNull();
  });
});

// ─── PR-B: การรับเรื่องพร้อมกันและการจองเลขติดตาม ───
describe('createCase · concurrent intake (integration)', () => {
  test('ยิงคำขอเดียวกันพร้อมกัน → เรื่องเดียว hash เดียว audit เดียว', async () => {
    const cid = cidFor(4);
    const input = webInput(cid, `ทดสอบชนพร้อมกัน ${RUN}`);
    createdEmails.push(cidEmail(cid));

    // § ทั้งสองคำขอเริ่มพร้อมกัน — unique constraint ของ users/cases/dedup_hashes
    // เป็นตัวตัดสิน ไม่ใช้ barrier ภายใน tx (จะทำให้ tx ค้างรอกันเองจนตายได้)
    const results = await Promise.all([createCase(input), createCase(input)]);

    const successes = results.filter((r) => r.ok);
    const duplicates = results.filter((r) => !r.ok && r.errorCode === 'duplicate');
    expect(successes).toHaveLength(1);
    expect(duplicates).toHaveLength(1);

    if (!successes[0]?.ok) return;
    createdCaseIds.push(successes[0].caseId);
    const db = await getDb();
    const rows = await db.select().from(cases).where(eq(cases.title, input.title));
    expect(rows).toHaveLength(1);
    const hash = generateDedupHash(cid, input.title, input.description);
    expect(await db.select().from(dedupHashes).where(eq(dedupHashes.hash, hash))).toHaveLength(1);
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, successes[0].caseId));
    expect(audits.map((a) => a.action)).toEqual(['submit_case']);
  }, 20000);

  test('สองคำขอสุ่มเลขติดตามตัวเดียวกัน → ได้เลขต่างกันหลัง retry', async () => {
    const forced = `HG${String(RUN).padStart(9, '0').slice(0, 9)}`;
    // § บังคับเฉพาะครั้งแรกของทั้งสองคำขอ — retry ต้องสุ่มรหัสใหม่เอง
    trackingControl.forcedQueue = [forced];
    const a = await createCase(webInput(cidFor(5), `ทดสอบชนเลขติดตาม A ${RUN}`));
    trackingControl.forcedQueue = [forced];
    const b = await createCase(webInput(cidFor(6), `ทดสอบชนเลขติดตาม B ${RUN}`));

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    createdCaseIds.push(a.caseId, b.caseId);
    createdEmails.push(cidEmail(cidFor(5)), cidEmail(cidFor(6)));
    expect(a.trackingCode).toBe(forced);
    expect(b.trackingCode).not.toBe(forced);
    expect(b.trackingCode).toMatch(/^HG\d{9}$/);
  });

  test('LINE ยิงซ้ำพร้อมกัน → ฝ่ายแพ้ได้ existingTrackingCode ของเรื่องที่ชนะ', async () => {
    const title = `ทดสอบ race LINE ${RUN}`;
    const input = {
      channel: 'line' as const,
      lineUserId: LINE_RACE,
      categoryId,
      title,
      description: 'รายละเอียด race LINE',
    };
    const results = await Promise.all([createCase(input), createCase(input)]);
    const winner = results.find((r) => r.ok);
    const loser = results.find((r) => !r.ok && r.errorCode === 'duplicate');

    expect(winner?.ok).toBe(true);
    expect(loser?.ok).toBe(false);
    if (!winner?.ok || !loser || loser.ok) return;
    createdCaseIds.push(winner.caseId);
    expect(loser.existingTrackingCode).toBe(winner.trackingCode);
  }, 20000);
});
