import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { caseFeedback, cases } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

/** สถานะที่ให้ดาวได้ — ปิดแล้ว (done นับด้วย: citizen เห็นว่าเสร็จ) */
const FEEDBACKABLE = ['done', 'closed'];

export type FeedbackError = 'bad_rating' | 'not_found' | 'wrong_status' | 'duplicate';

export async function submitFeedback(input: {
  trackingCode: string;
  rating: number;
  comment?: string;
}): Promise<{ ok: true } | { ok: false; code: FeedbackError; error: string }> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, code: 'bad_rating', error: 'คะแนนต้องเป็น 1-5 ดาว' };
  }

  const db = await getDb();
  const row = await firstOrUndefined(
    db
      .select({ id: cases.id, status: cases.status })
      .from(cases)
      .where(eq(cases.trackingCode, input.trackingCode.trim()))
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
  } catch {
    // § unique(caseId) — ให้แล้วให้เลย ตอบซ้ำได้ 409 (ไม่ update ทับ)
    return { ok: false, code: 'duplicate', error: 'เรื่องนี้ให้คะแนนไปแล้ว' };
  }
  return { ok: true };
}
