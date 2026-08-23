/**
 * POST /api/consent/withdraw — ประชาชนถอนความยินยอม PDPA
 *
 * Body: { trackingCode, cid }
 * - ตรวจสอบว่า trackingCode + cid ตรงกับเคสที่มีอยู่
 * - บันทึก consent withdrawal record
 * - audit log
 *
 * หลังถอน: เคสจะไม่แสดงใน /track (hasConsent คืน false)
 *
 * Rate limit: 5 requests / 10 นาที per IP (กัน abuse)
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, lineUsers, users } from '@/lib/db/schema';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/upstash';
import { normalizeTrackingCode } from '@/lib/case-tracking';
import { generateCidHash } from '@/lib/cid-hmac';
import { revokeConsent } from '@/lib/consent';
import { consentWithdrawSchema, consentWithdrawLineSchema, validateOrError } from '@/lib/validation';
import { LIFF_SESSION_COOKIE, readLiffSessionValue } from '@/lib/liff/session';

// § คำตอบเดียวสำหรับ "ไม่พบเคส" / "มีเคสแต่ CID ไม่ตรง" / "ไม่มี user row"
// เดิมแยก 404 กับ 403 ทำให้บอกได้ว่า tracking code ไหนมีอยู่จริงโดยไม่ต้องรู้ CID
// (เป็น enumeration oracle) — GET /api/cases/[id] ตั้งใจคืน 404 เหมือนกันหมดอยู่แล้ว
// ที่นี่จึงต้องเดินตามแบบเดียวกัน
const WITHDRAW_DENIED = { error: 'ไม่พบเรื่องที่ระบุ หรือข้อมูลไม่ตรงกับเจ้าของเรื่อง' };

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

  // § Rate limit — 5 requests / 10 minutes (ถี่เกินไป = น่าสงสัย)
  // failOpen: false — endpoint นี้ยืนยันตัวตนด้วย trackingCode + CID และทำงานทำลายข้อมูล
  // (ถอนความยินยอม) ถ้า Redis ล่มแล้วปล่อยผ่าน = เดา CID ได้ไม่จำกัด นับเป็น auth path
  const rateLimit = await checkRateLimit(`rate:consent-withdraw:${ip}`, 5, 600, {
    failOpen: false,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'ส่งคำขอถี่เกินไป กรุณารอ ' + rateLimit.reset + ' วินาที' },
      { status: 429 },
    );
  }

  // § Parse + validate body ด้วย zod
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = await getDb();

  // § ทางถอนแบบ LIFF — ผู้ใช้ที่แจ้งผ่าน LIFF ไม่มี CID ในระบบ (D1) จึงยืนยันความ
  // เป็นเจ้าของเคสด้วย liff session cookie แทน: เคสต้องถูกส่งโดย linkedUserId ของ
  // LINE user คนนี้เท่านั้น
  const liffSession = readLiffSessionValue(req.cookies.get(LIFF_SESSION_COOKIE)?.value);
  if (liffSession) {
    const validation = validateOrError(consentWithdrawLineSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const lineTrackingCode = normalizeTrackingCode(validation.data.trackingCode);
    if (!lineTrackingCode) {
      return NextResponse.json(WITHDRAW_DENIED, { status: 404 });
    }

    const lineCaseRow = await firstOrUndefined(
      db.select({ id: cases.id, submittedBy: cases.submittedBy }).from(cases).where(eq(cases.trackingCode, lineTrackingCode)).limit(1),
    );
    if (!lineCaseRow) {
      return NextResponse.json(WITHDRAW_DENIED, { status: 404 });
    }

    const owned = await firstOrUndefined(
      db
        .select({ id: lineUsers.id })
        .from(lineUsers)
        .where(and(eq(lineUsers.lineUserId, liffSession.lineUserId), eq(lineUsers.linkedUserId, lineCaseRow.submittedBy)))
        .limit(1),
    );
    if (!owned) {
      await logAudit({
        action: AUDIT_ACTIONS.CONSENT_WITHDRAW_DENIED,
        resource: 'consent',
        resourceId: lineCaseRow.id,
        ipAddress: ip,
        userAgent: req.headers.get('user-agent') || undefined,
        metadata: { reason: 'not_case_owner_line' },
      });
      return NextResponse.json(WITHDRAW_DENIED, { status: 404 });
    }

    await revokeConsent(lineCaseRow.submittedBy, 'data_collection', {
      via: 'liff_withdraw',
      caseId: lineCaseRow.id,
      trackingCode: lineTrackingCode,
    });

    await logAudit({
      userId: lineCaseRow.submittedBy,
      action: AUDIT_ACTIONS.CONSENT_WITHDRAWN,
      resource: 'consent',
      resourceId: lineCaseRow.id,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') || undefined,
      metadata: { trackingCode: lineTrackingCode, via: 'liff' },
    });

    return NextResponse.json({
      success: true,
      message: 'ถอนความยินยอมเรียบร้อย — ข้อมูลของคุณจะไม่สามารถเข้าถึงได้ผ่านระบบติดตามงาน',
    });
  }

  const validation = validateOrError(consentWithdrawSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { trackingCode: rawTrackingCode, cid } = validation.data;

  // § Normalize tracking code
  const trackingCode = normalizeTrackingCode(rawTrackingCode);
  if (!trackingCode) {
    // ไม่เปิดเผยว่า format ผิด — คืนคำตอบเดียวกับเคสไม่พบ
    return NextResponse.json(WITHDRAW_DENIED, { status: 404 });
  }

  // § Lookup case by trackingCode
  const caseRow = await firstOrUndefined(
    db.select({ id: cases.id, submittedBy: cases.submittedBy }).from(cases).where(eq(cases.trackingCode, trackingCode)).limit(1),
  );

  if (!caseRow) {
    return NextResponse.json(WITHDRAW_DENIED, { status: 404 });
  }

  // § Verify CID matches — ตัวตนของผู้แจ้งทางเว็บผูกกับ HMAC ของ CID เสมอ
  // (ดู resolveSubmitter ใน lib/cases/intake.ts — email ที่กรอกไม่ใช่ identity key)
  const cidHash = generateCidHash(cid);
  const cidEmail = `cid-${cidHash}@placeholder.local`;

  const userRow = await firstOrUndefined(
    db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, caseRow.submittedBy)).limit(1),
  );

  // § CID ไม่ตรงกับเจ้าของเคส (หรือหา user row ไม่เจอ) — คำตอบเดียวกับ "ไม่พบเคส"
  // เพื่อไม่ให้แยกออกว่า tracking code นี้มีอยู่จริงหรือไม่
  if (!userRow || userRow.email !== cidEmail) {
    await logAudit({
      action: AUDIT_ACTIONS.CONSENT_WITHDRAW_DENIED,
      resource: 'consent',
      resourceId: caseRow.id,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') || undefined,
      metadata: { reason: userRow ? 'cid_mismatch' : 'submitter_missing' },
    });
    return NextResponse.json(WITHDRAW_DENIED, { status: 404 });
  }

  // § Revoke consent
  await revokeConsent(userRow.id, 'data_collection', {
    via: 'web_withdraw',
    caseId: caseRow.id,
    trackingCode,
  });

  await logAudit({
    userId: userRow.id,
    action: AUDIT_ACTIONS.CONSENT_WITHDRAWN,
    resource: 'consent',
    resourceId: caseRow.id,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') || undefined,
    metadata: { trackingCode },
  });

  return NextResponse.json({
    success: true,
    message: 'ถอนความยินยอมเรียบร้อย — ข้อมูลของคุณจะไม่สามารถเข้าถึงได้ผ่านระบบติดตามงาน',
  });
}
