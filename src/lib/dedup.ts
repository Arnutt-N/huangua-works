/**
 * Deduplication — ป้องกันการแจ้งเรื่องซ้ำซ้อนภายใน 7 วัน
 * ใช้ HMAC-SHA256 hash ของ (CID + title + description)
 */

import { getDb } from './db';
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
  description: string
): Promise<{ isDuplicate: boolean; caseId?: string }> {
  const db = getDb();
  const hash = generateDedupHash(cid, title, description);
  const now = Date.now();

  const existing = await db
    .select()
    .from(dedupHashes)
    .where(and(eq(dedupHashes.hash, hash), gt(dedupHashes.expiresAt, new Date(now))))
    .get();

  if (existing) {
    return { isDuplicate: true, caseId: existing.caseId };
  }

  return { isDuplicate: false };
}

/**
 * บันทึก hash เพื่อป้องกันซ้ำ
 */
export async function recordDedupHash(
  cid: string,
  title: string,
  description: string,
  caseId: string
): Promise<void> {
  const db = getDb();
  const hash = generateDedupHash(cid, title, description);
  const expiresAt = new Date(Date.now() + DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(dedupHashes).values({
    id: generateId(),
    hash,
    caseId,
    expiresAt,
  });
}

/**
 * ลบ hash ที่หมดอายุ (cleanup — เรียกจาก cron)
 */
export async function cleanupExpiredHashes(): Promise<number> {
  const db = getDb();
  const now = new Date();

  const result = await db
    .delete(dedupHashes)
    .where(lte(dedupHashes.expiresAt, now))
    .run();

  return result.changes;
}
