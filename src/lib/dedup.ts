/**
 * Deduplication — ป้องกันการแจ้งเรื่องซ้ำซ้อนภายใน 7 วัน
 * ใช้ HMAC-SHA256 hash ของ (CID + title + description)
 */

import { getDb, type DbOrTx } from './db';
import { firstOrUndefined } from './db/query-helpers';
import { dedupHashes } from './db/schema';
import { generateId } from './id';
import { generateDedupHash, generateLegacyDedupHash } from './cid-hmac';
import { eq, sql, and, gt, inArray, lte } from 'drizzle-orm';

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
  // § เทียบทั้ง hash ใหม่ + hash เก่า (สูตร normalize เก่า) — เรื่องที่บันทึกก่อน deploy
  // ยังจับซ้ำได้ตลอด 7 วัน window หลังนั้นแถวเก่าหมดอายุเอง
  const hashes = [generateDedupHash(cid, title, description)];
  // § ลบ legacy ได้ (บรรทัดนี้ + generateLegacyDedupHash/legacyDedupPayload ใน cid-hmac.ts) เมื่อพ้น
  // 7 วันหลัง deploy production ที่มี #117 — ตรวจก่อนลบ: SELECT count(*) FROM dedup_hashes
  // WHERE created_at < '<วัน deploy>' AND expires_at > now() ต้องได้ 0
  const legacy = generateLegacyDedupHash(cid, title, description);
  if (legacy !== hashes[0]) hashes.push(legacy);
  const now = Date.now();

  const existing = await firstOrUndefined(
    _db
      .select()
      .from(dedupHashes)
      .where(and(inArray(dedupHashes.hash, hashes), gt(dedupHashes.expiresAt, new Date(now))))
      .limit(1)
  );

  if (existing) {
    return { isDuplicate: true, caseId: existing.caseId };
  }

  return { isDuplicate: false };
}

/**
 * § เจ้าของสิทธิ์เขียน hash ต้องเป็น UNIQUE constraint ไม่ใช่ SELECT ก่อน insert
 * แถวที่ยังไม่หมดอายุ = duplicate → DO NOTHING
 * แถวที่หมดอายุแล้ว = เรื่องเก่าหลุด window → อัปเดต caseId/expiresAt ให้เรื่องใหม่
 * ทั้งสองทาง RETURNING caseId ของแถวที่ชนะ เพื่อให้ caller ตัดสินได้ใน transaction เดียว
 */
export async function claimDedupHash(
  cid: string,
  title: string,
  description: string,
  caseId: string,
  db?: DbOrTx,
): Promise<{ caseId: string; fingerprint?: string }> {
  const _db = db ?? await getDb();
  const hash = generateDedupHash(cid, title, description);
  const expiresAt = new Date(Date.now() + DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rows = await _db
    .insert(dedupHashes)
    .values({ id: generateId(), hash, caseId, expiresAt })
    .onConflictDoUpdate({
      target: dedupHashes.hash,
      // § setWhere (ไม่ใช่ targetWhere): targetWhere เป็น prediction ของ partial unique index
      // แต่(hash) เป็น unique ธรรมดา → inference ไม่ตรง แล้ว DO UPDATE ก็จะอัปเดต
      // ทั้งแถวที่ยังไม่หมดอายุ ทำให้เรื่องเก่าถูกแย่ง
      setWhere: lte(dedupHashes.expiresAt, sql`now()`),
      set: { caseId, expiresAt },
    })
    .returning({ caseId: dedupHashes.caseId, id: dedupHashes.id });

  // § ถ้า DO NOTHING (แถวยังไม่หมดอายุ) RETURNING จะว่าง — ต้องอ่านเจ้าของเดิม
  // ไม่ใช่คืน caseId ของผู้พยายาม (ไม่งั้น caller คิดว่าชนะแล้วสร้างเรื่องซ้ำ)
  if (rows[0]) return { caseId: rows[0].caseId, fingerprint: rows[0].id };
  const existing = await firstOrUndefined(
    _db.select({ caseId: dedupHashes.caseId, id: dedupHashes.id }).from(dedupHashes).where(eq(dedupHashes.hash, hash)).limit(1),
  );
  return { caseId: existing?.caseId ?? caseId, fingerprint: existing?.id };
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
