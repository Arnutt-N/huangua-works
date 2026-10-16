import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { dedupHashes } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { generateDedupHash, generateLegacyDedupHash } from '@/lib/cid-hmac';
import { checkDuplicate } from './dedup';

/**
 * checkDuplicate ช่วงเปลี่ยนผ่านสูตร normalize (#117) — ข้อมูลสมมติล้วน (prefix it-dedup)
 * แถวที่บันทึกด้วย hash สูตรเก่าก่อน deploy ต้องยังจับซ้ำได้จนหมดอายุ
 */

const RUN = Date.now();
const insertedIds: string[] = [];

async function insertRow(hash: string, expiresInMs: number): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const caseId = `it-dedup-case-${RUN}-${insertedIds.length}`;
  await db.insert(dedupHashes).values({ id, hash, caseId, expiresAt: new Date(Date.now() + expiresInMs) });
  insertedIds.push(id);
  return caseId;
}

afterAll(async () => {
  const db = await getDb();
  if (insertedIds.length) await db.delete(dedupHashes).where(inArray(dedupHashes.id, insertedIds));
  await closeDb();
});

describe('checkDuplicate · legacy hash', () => {
  test('แถว hash สูตรเก่าที่ยังไม่หมดอายุ → จับซ้ำได้ (input มีช่องว่างคู่ จึงพิสูจน์ทาง legacy)', async () => {
    const cid = `it-dedup-legacy-${RUN}`;
    const caseId = await insertRow(generateLegacyDedupHash(cid, 'ถนน  ชำรุด', 'x'), 24 * 60 * 60 * 1000);

    expect(await checkDuplicate(cid, 'ถนน  ชำรุด', 'x')).toEqual({ isDuplicate: true, caseId });
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
