/**
 * POST /api/cases/submit — รับเรื่องแจ้งเรื่องใหม่จากประชาชน
 * Rate limit: 3 requests / 5 minutes per IP
 * Deduplication: 7 วัน sliding window (CID + title + description)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isValidCid } from '@/lib/cid-checksum';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import { submitCaseSchema, submitCaseLineSchema, validateOrError } from '@/lib/validation';
import { isSpamSubmission } from '@/lib/anti-spam';
import { createCase } from '@/lib/cases/intake';
import { LIFF_SESSION_COOKIE, readLiffSessionValue } from '@/lib/liff/session';

export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers);

  // § Rate limit — 3 requests / 5 minutes (RATE_LIMIT_POLICIES.submit — public, fail-open)
  const rateLimit = await enforceRateLimit('submit', ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'ส่งเรื่องถี่เกินไป กรุณารอ ' + rateLimit.reset + ' วินาที' },
      { status: 429 }
    );
  }

  // § ตัวตนแบบ LIFF อ่านจาก session cookie เท่านั้น (server sign ไว้) — ห้ามรับ
  // lineUserId จาก body เด็ดขาด เพราะ client ปลอมได้
  const liffSession = readLiffSessionValue(req.cookies.get(LIFF_SESSION_COOKIE)?.value);

  // § Parse body + validate ด้วย zod (แทน manual checks ทั้งหมด)
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // § กันสแปม (honeypot + จับเวลากรอก) — ตรวจก่อน validate เพื่อตัดบอททิ้งเร็ว
  // error ต้อง generic เหมือน validation ทั่วไป ห้ามบอกว่าโดนจับว่าเป็นบอท
  // (ดู src/lib/anti-spam.ts) — ตรวจจาก body ดิบเพราะทั้งสอง schema มีฟิลด์นี้
  const raw = body as { websiteUrl?: unknown; formStartedAt?: unknown };
  if (
    isSpamSubmission(
      {
        websiteUrl: typeof raw.websiteUrl === 'string' ? raw.websiteUrl : undefined,
        formStartedAt: typeof raw.formStartedAt === 'number' ? raw.formStartedAt : undefined,
      },
      Date.now(),
    )
  ) {
    return NextResponse.json(
      { error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่' },
      { status: 400 },
    );
  }

  if (liffSession) {    const validation = validateOrError(submitCaseLineSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { fullName, phoneNumber, email, categoryId, title, description, location, provinceId, districtId, subDistrictId, villageId, village, attachments } = validation.data;

    const result = await createCase({
      channel: 'line',
      origin: 'liff',
      lineUserId: liffSession.lineUserId,
      title,
      description,
      location,
      categoryId,
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
        { error: result.error, ...(result.existingTrackingCode ? { existingTrackingCode: result.existingTrackingCode } : {}) },
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
      { error: result.error, ...(result.existingTrackingCode ? { existingTrackingCode: result.existingTrackingCode } : {}) },
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
