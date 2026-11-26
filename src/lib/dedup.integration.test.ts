import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { cases, dedupHashes } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { generateDedupHash, generateLegacyDedupHash } from '@/lib/cid-hmac';
import { checkDuplicate, claimDedupHash } from './dedup';

/**
 * checkDuplicate ช่วงเปลี่ยนผ่านสูตร normalize (#117) — ข้อมูลสมมติล้วน (prefix it-dedup)
 * แถวที่บันทึกด้วย hash สูตรเก่าก่อน deploy ต้องยังจับซ้ำได้จนหมดอายุ
 */

const RUN = Date.now();
const insertedIds: string[] = [];
const insertedCaseIds: string[] = [];

async function insertRow(hash: string, expiresInMs: number): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const caseId = `it-dedup-case-${RUN}-${insertedIds.length}`;
  await db.insert(dedupHashes).values({ id, hash, caseId, expiresAt: new Date(Date.now() + expiresInMs) });
  insertedIds.push(id);
  return caseId;
}

/** § แถว hash เก่าต้องมีเรื่องจริงให้เทียบ field — ไม่เช่นนั้นตรวจ ambiguity ไม่ได้ */
async function insertLegacyCase(title: string, description: string, hash: string): Promise<string> {
  const db = await getDb();
  const caseId = await insertRow(hash, 24 * 60 * 60 * 1000);
  await db.insert(cases).values({
    id: caseId,
    status: 'pending',
    title,
    description,
    location: '',
    categoryId: `it-dedup-cat-${RUN}`,
    submittedBy: `it-dedup-submitter-${RUN}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  insertedCaseIds.push(caseId);
  return caseId;
}

afterAll(async () => {
  const db = await getDb();
  if (insertedIds.length) await db.delete(dedupHashes).where(inArray(dedupHashes.id, insertedIds));
  if (insertedCaseIds.length) await db.delete(cases).where(inArray(cases.id, insertedCaseIds));
  await closeDb();
});

describe('checkDuplicate · legacy hash', () => {
  test('แถว hash สูตรเก่าที่ยังไม่หมดอายุ → จับซ้ำได้ (input มีช่องว่างคู่ จึงพิสูจน์ทาง legacy)', async () => {
    const cid = `it-dedup-legacy-${RUN}`;
    const title = 'ถนน  ชำรุด';
    const caseId = await insertLegacyCase(title, 'x', generateLegacyDedupHash(cid, title, 'x'));

    expect(await checkDuplicate(cid, title, 'x')).toEqual({ isDuplicate: true, caseId });
  });

  test('hash เก่าที่ชนกันจากคนละ tuple → เทียบ field จริงแล้วไม่ปฏิเสธเรื่องใหม่', async () => {
    const cid = `it-dedup-ambiguous-${RUN}`;
    const storedTitle = 'b|c';
    await insertLegacyCase(storedTitle, 'd', generateLegacyDedupHash(cid, storedTitle, 'd'));

    // § เรื่องใหม่มี title='b' แต่ legacy payload รวมกับ cid='a|b' แล้วชนแถวเดิม
    expect(await checkDuplicate('a|b', 'c', 'd')).toEqual({ isDuplicate: false });
  });

  test('แถว hash สูตรเก่าที่หมดอายุแล้ว → ไม่ซ้ำ', async () => {
    const cid = `it-dedup-expired-${RUN}`;
    await insertRow(generateLegacyDedupHash(cid, 'ถนน  ชำรุด', 'x'), -60 * 1000);

    expect(await checkDuplicate(cid, 'ถนน  ชำรุด', 'x')).toEqual({ isDuplicate: false });
  });

  test('สูตรใหม่จับ whitespace-variant ได้', async () => {
    const cid = `it-dedup-new-${RUN}`;
    const caseId = await insertRow(generateDedupHash(cid, 'ถนน ชำรุด', 'x'), 24 * 60 * 60 * 1000);

    expect(await checkDuplicate(cid, 'ถนน   ชำรุด', 'x')).toEqual({ isDuplicate: true, caseId });
  });
});

describe('claimDedupHash · สิทธิ์เขียนด้วย unique constraint', () => {
  test('แถวหมดอายุถูกต่ออายุและเปลี่ยนเจ้าของ → คำขอถัดไปซ้ำทันที', async () => {
    const db = await getDb();
    const cid = `it-dedup-claim-expired-${RUN}`;
    const title = `ถนน เสีย ${RUN}`;
    const desc = 'รายละเอียดต่ออายุ';
    const oldCaseId = await insertRow(generateDedupHash(cid, title, desc), -60 * 1000);
    const newCaseId = `it-dedup-claim-new-${RUN}`;

    const claimed = await claimDedupHash(cid, title, desc, newCaseId);
    expect(claimed.caseId).toBe(newCaseId);

    const rows = await db.select().from(dedupHashes).where(inArray(dedupHashes.caseId, [oldCaseId, newCaseId]));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.caseId).toBe(newCaseId);
    expect(rows[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(await checkDuplicate(cid, title, desc)).toEqual({ isDuplicate: true, caseId: newCaseId });
  });

  test('แถวยังไม่หมดอายุ → ไม่ถูกแย่งและคืน caseId เดิม', async () => {
    const cid = `it-dedup-claim-live-${RUN}`;
    const title = `ไฟฟ้า ขัดข้อง ${RUN}`;
    const desc = 'รายละเอียดยังไม่หมดอายุ';
    const owner = await insertRow(generateDedupHash(cid, title, desc), 24 * 60 * 60 * 1000);

    const claimed = await claimDedupHash(cid, title, desc, `it-dedup-claim-intruder-${RUN}`);
    expect(claimed.caseId).toBe(owner);
  });
});
