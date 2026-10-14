/**
 * POST /api/feedback — ให้ดาวเรื่องที่เสร็จ/ปิดแล้ว (public, ไม่ต้อง login)
 *
 * Rate limit: 10 requests / 5 นาที per IP (กันสแปมดาว — public fail-open)
 * ตอบซ้ำได้ 409 (เคสละ 1 ครั้ง)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/api-helpers';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { formatReset } from '@/lib/rate-limit/format-reset';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import { submitFeedback } from '@/lib/cases/feedback';

export const runtime = 'nodejs';

const feedbackSchema = z.object({
  trackingCode: z.string().trim().min(1).max(32),
  rating: z.number(),
  comment: z.string().trim().max(500).optional(),
});

const STATUS_BY_CODE = {
  bad_rating: 400,
  not_found: 404,
  wrong_status: 422,
  duplicate: 409,
  server_error: 500,
} as const;

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const rateLimit = await enforceRateLimit('feedbackSubmit', ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'ส่งถี่เกินไป กรุณารอ ' + formatReset(rateLimit.reset) },
      { status: 429 },
    );
  }

  const parsed = await parseBody(feedbackSchema, request);
  if (!parsed.ok) return parsed.response;

  const result = await submitFeedback(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: STATUS_BY_CODE[result.code] });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
