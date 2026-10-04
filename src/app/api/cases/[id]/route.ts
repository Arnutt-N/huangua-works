/**
 * GET /api/cases/[id] — ดูสถานะเรื่องที่แจ้ง (สำหรับ citizen track)
 *
 * [id] คือ **trackingCode** (HG/HN + 9 หลัก) ไม่ใช่ UUID PK
 * เพื่อไม่เปิดเผย UUID v7 ที่ timestamp-ordered และเดาได้
 *
 * ความปลอดภัย (PDPA):
 * - Rate limit 10 ครั้ง/5 นาทีต่อ IP — กัน brute force tracking code (อยู่ที่ route นี้)
 * - Tracking code เป็น random 30-bit + rate limit → คาดเดาไม่ได้ในทางปฏิบัติ
 * - การค้น / กติกาความยินยอม / ตัด PII / audit อยู่ใน citizen-access (กติกาเดียวกับบอท LINE)
 * - 404 ทุกกรณีที่ไม่พบ (format ผิด / code ผิด / เคสเก่าไม่มี trackingCode / ถอนความยินยอมแล้ว)
 *   ไม่บอกสาเหตุ เพื่อกัน enumeration
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import { findTrackableCase } from '@/lib/cases/citizen-access';

const NOT_FOUND = { error: 'ไม่พบเรื่องนี้' };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const ip = clientIpFromHeaders(req.headers);

  // § Rate limit — 10 requests / 5 minutes per IP (fail-open เหมือน submit)
  // (RATE_LIMIT_POLICIES.track)
  const rateLimit = await enforceRateLimit('track', ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'ค้นหาถี่เกินไป กรุณารอ ' + rateLimit.reset + ' วินาที' },
      { status: 429 }
    );
  }

  const view = await findTrackableCase(rawId, {
    channel: 'web',
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') || undefined,
  });
  if (!view) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  return NextResponse.json(view);
}
