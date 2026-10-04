/**
 * Deduplication — ป้องกันการแจ้งเรื่องซ้ำซ้อนภายใน 7 วัน
 * ใช้ HMAC-SHA256 hash ของ (CID + title + description)
 */

import { getDb, type DbOrTx } from './db';
import { firstOrUndefined } from './db/query-helpers';
import { dedupHashes } from './db/schema';
import { generateId } from './id';
import { generateDedupHash } from './cid-hmac';
import { eq, and, gt, lte } from 'drizzle-orm';

const DEDUP_WINDOW_DAYS = 7;

/**
 * ตรวจสอบว่ามีเรื่องซ้ำหรือไม่
 */
export async function checkDuplicate(
  cid: string,
  title: string,
  description: string,
  db?: DbOrTx,
): Promise<{ isDuplicate: boolean; caseId?: string }> {
  const _db = db ?? await getDb();
  const hash = generateDedupHash(cid, title, description);
  const now = Date.now();

  const existing = await firstOrUndefined(
    _db
      .select()
      .from(dedupHashes)
      .where(and(eq(dedupHashes.hash, hash), gt(dedupHashes.expiresAt, new Date(now))))
      .limit(1)
  );

  if (existing) {
    return { isDuplicate: true, caseId: existing.caseId };
  }

  return { isDuplicate: false };
}

/**
 * บันทึก hash เพื่อป้องกันซ้ำ
 *
 * § ห้าม catch-unique: createCase เรียกฟังก์ชันนี้ใน transaction ถ้าชน unique(hash)
 * แบบ concurrent แล้ว statement error จะทำให้ทั้ง tx abort
 * ใช้ ON CONFLICT DO NOTHING เพื่อไม่ throw และ RETURNING เพื่อคืน caseId ของแถวที่ชนะ
 */
export async function recordDedupHash(
  cid: string,
  title: string,
  description: string,
  caseId: string,
  db?: DbOrTx,
): Promise<string> {
  const _db = db ?? await getDb();
  const hash = generateDedupHash(cid, title, description);
  const expiresAt = new Date(Date.now() + DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const inserted = await _db
    .insert(dedupHashes)
    .values({
      id: generateId(),
      hash,
      caseId,
      expiresAt,
    })
    .onConflictDoNothing({ target: dedupHashes.hash })
    .returning({ caseId: dedupHashes.caseId });

  if (inserted[0]?.caseId) {
    return inserted[0].caseId;
  }

  const existing = await firstOrUndefined(
    _db.select({ caseId: dedupHashes.caseId }).from(dedupHashes).where(eq(dedupHashes.hash, hash)).limit(1)
  );
  return existing?.caseId ?? caseId;
}

/**
 * ลบ hash ที่หมดอายุ (cleanup — เรียกจาก cron)
 */
export async function cleanupExpiredHashes(db?: DbOrTx): Promise<number> {
  const _db = db ?? await getDb();
  const now = new Date();

  const result = await _db
    .delete(dedupHashes)
    .where(lte(dedupHashes.expiresAt, now));

  return result.count;
}
