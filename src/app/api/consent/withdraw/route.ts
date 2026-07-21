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
import { cases, users } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/upstash';
import { normalizeTrackingCode } from '@/lib/case-tracking';
import { generateCidHash } from '@/lib/cid-hmac';
import { revokeConsent } from '@/lib/consent';
import { consentWithdrawSchema, validateOrError } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  // § Rate limit — 5 requests / 10 minutes (ถี่เกินไป = น่าสงสัย)
  const rateLimit = await checkRateLimit(`rate:consent-withdraw:${ip}`, 5, 600);
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

  const validation = validateOrError(consentWithdrawSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { trackingCode: rawTrackingCode, cid } = validation.data;

  // § Normalize tracking code
  const trackingCode = normalizeTrackingCode(rawTrackingCode);
  if (!trackingCode) {
    // ไม่เปิดเผยว่า format ผิด — คืน 404 เหมือนเคสไม่พบ
    return NextResponse.json({ error: 'ไม่พบเรื่องที่ระบุ' }, { status: 404 });
  }

  const db = await getDb();

  // § Lookup case by trackingCode
  const caseRow = await firstOrUndefined(
    db.select({ id: cases.id, submittedBy: cases.submittedBy }).from(cases).where(eq(cases.trackingCode, trackingCode)).limit(1),
  );

  if (!caseRow) {
    return NextResponse.json({ error: 'ไม่พบเรื่องที่ระบุ' }, { status: 404 });
  }

  // § Verify CID matches — citizen email ถูกสร้างจาก HMAC hash ของ CID
  // ถ้ามี email จริงก็ใช้ email lookup แทน
  const cidHash = generateCidHash(cid);
  const cidEmail = `cid-${cidHash}@placeholder.local`;

  const userRow = await firstOrUndefined(
    db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, caseRow.submittedBy)).limit(1),
  );

  if (!userRow) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });
  }

  // § ตรวจว่า CID ตรงกับเจ้าของเคสจริง — โดยเทียบ email hash
  // ถ้า user ใช้ email จริง (ไม่ใช่ placeholder) ก็ยังต้องเช็ค CID hash ผ่าน dedup
  // แต่เพื่อความเรียบง่ายใน MVP: เช็คจาก cid hash placeholder email
  if (userRow.email !== cidEmail) {
    // CID ไม่ตรงกับเจ้าของเคส — ไม่เปิดเผยข้อมูล
    await logAudit({
      action: 'consent_withdraw_denied',
      resource: 'consent',
      resourceId: caseRow.id,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') || undefined,
      metadata: { reason: 'cid_mismatch' },
    });
    return NextResponse.json({ error: 'ข้อมูลไม่ตรงกับเจ้าของเรื่อง' }, { status: 403 });
  }

  // § Revoke consent
  await revokeConsent(userRow.id, 'data_collection', {
    via: 'web_withdraw',
    caseId: caseRow.id,
    trackingCode,
  });

  await logAudit({
    userId: userRow.id,
    action: 'consent_withdrawn',
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
