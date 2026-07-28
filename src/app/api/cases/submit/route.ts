/**
 * POST /api/cases/submit — รับเรื่องแจ้งเหตุจากประชาชน
 * Rate limit: 3 requests / 5 minutes per IP
 * Deduplication: 7 วัน sliding window (CID + title + description)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isValidCid } from '@/lib/cid-checksum';
import { checkRateLimit } from '@/lib/upstash';
import { submitCaseSchema, validateOrError } from '@/lib/validation';
import { createCase } from '@/lib/cases/intake';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

  // § Rate limit — 3 requests / 5 minutes
  const rateLimitKey = `rate:submit:${ip}`;
  const rateLimit = await checkRateLimit(rateLimitKey, 3, 300);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'ส่งเรื่องถี่เกินไป กรุณารอ ' + rateLimit.reset + ' วินาที' },
      { status: 429 }
    );
  }

  // § Parse body + validate ด้วย zod (แทน manual checks ทั้งหมด)
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = validateOrError(submitCaseSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { cid, fullName, phoneNumber, email, categoryId, title, description, location, provinceId, districtId, subDistrictId, villageId, village, attachments } = validation.data;

  // § CID checksum check (zod ตรวจ format 13 หลักเท่านั้น — checksum ตรวจที่นี่)
  if (!isValidCid(cid)) {
    return NextResponse.json({ error: 'เลขบัตรประชาชนไม่ถูกต้อง' }, { status: 400 });
  }

  const result = await createCase({
    channel: 'web',
    title,
    description,
    location,
    categoryId,
    cid,
    fullName,
    phoneNumber,
    email,
    provinceId,
    districtId,
    subDistrictId,
    villageId,
    village,
    attachments,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') || undefined,
  });

  if (!result.ok) {
    const status = result.errorCode === 'duplicate' ? 409 : result.errorCode === 'invalid_category' ? 400 : 500;
    return NextResponse.json(
      { error: result.error, ...(result.existingCaseId ? { existingCaseId: result.existingCaseId } : {}) },
      { status }
    );
  }

  return NextResponse.json(
    {
      success: true,
      caseId: result.caseId,
      trackingCode: result.trackingCode,
      message: 'รับเรื่องเรียบร้อย — เจ้าหน้าที่จะติดตามภายใน ' + result.estimatedDays + ' วัน',
    },
    { status: 201 }
  );
}
