import { eq } from 'drizzle-orm';
import { normalizeTrackingCode } from '@/lib/case-tracking';
import { getDb } from '@/lib/db';
import { isUniqueViolation } from '@/lib/db/errors';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { caseFeedback, cases } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

/** สถานะที่ให้ดาวได้ — ปิดแล้ว (done นับด้วย: citizen เห็นว่าเสร็จ) */
const FEEDBACKABLE = ['done', 'closed'];

export type FeedbackError = 'bad_rating' | 'not_found' | 'wrong_status' | 'duplicate' | 'server_error';

export async function submitFeedback(input: {
  trackingCode: string;
  rating: number;
  comment?: string;
}): Promise<{ ok: true } | { ok: false; code: FeedbackError; error: string }> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, code: 'bad_rating', error: 'คะแนนต้องเป็น 1-5 ดาว' };
  }

  // § สัญญาเดียวกับหน้าติดตาม (ตัวเล็ก/ช่องว่าง/ขีดได้) — ไม่ตรง canonical คือไม่พบ
  const code = normalizeTrackingCode(input.trackingCode);
  if (!code) return { ok: false, code: 'not_found', error: 'ไม่พบเลขติดตามนี้' };

  const db = await getDb();
  const row = await firstOrUndefined(
    db
      .select({ id: cases.id, status: cases.status })
      .from(cases)
      .where(eq(cases.trackingCode, code))
      .limit(1),
  );
  if (!row) return { ok: false, code: 'not_found', error: 'ไม่พบเลขติดตามนี้' };
  if (!FEEDBACKABLE.includes(row.status)) {
    return { ok: false, code: 'wrong_status', error: 'ให้คะแนนได้เฉพาะเรื่องที่เสร็จหรือปิดแล้ว' };
  }

  try {
    await db.insert(caseFeedback).values({
      id: generateId(),
      caseId: row.id,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    });
  } catch (err) {
    // § 409 เฉพาะชน unique(caseId) จริง — ที่เหลือคือ 500 (interrogate B-14)
    // ตอบ 409 มั่วบอกลูกบ้านว่าให้แล้วทั้งที่ไม่ได้ให้ แถม monitoring มองไม่เห็น outage
    if (isUniqueViolation(err)) {
      return { ok: false, code: 'duplicate', error: 'เรื่องนี้ให้คะแนนไปแล้ว' };
    }
    console.error('[feedback] insert failed', err);
    return { ok: false, code: 'server_error', error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' };
  }
  return { ok: true };
}
