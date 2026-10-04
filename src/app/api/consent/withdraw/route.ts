/**
 * POST /api/consent/withdraw — ประชาชนถอนความยินยอม PDPA
 *
 * Body: { trackingCode, cid } (เว็บ) หรือ { trackingCode } + liff session cookie (LINE)
 * การพิสูจน์ความเป็นเจ้าของ / revoke / audit อยู่ใน citizen-access (withdrawCaseConsent)
 *
 * หลังถอน: เรื่องจะไม่แสดงในทุกช่องทาง (ติดตามเรื่องทางเว็บ / บอท LINE / เรื่องของฉันใน LIFF)
 *
 * Rate limit: 5 requests / 10 นาที per IP (กัน abuse)
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import { withdrawCaseConsent, type OwnershipProof } from '@/lib/cases/citizen-access';
import { consentWithdrawSchema, consentWithdrawLineSchema, validateOrError } from '@/lib/validation';
import { LIFF_SESSION_COOKIE, readLiffSessionValue } from '@/lib/liff/session';

// § คำตอบเดียวสำหรับ "ไม่พบเคส" / "มีเคสแต่ CID ไม่ตรง" / "ไม่มี user row" / "LINE ไม่ใช่เจ้าของ"
// เดิมแยก 404 กับ 403 ทำให้บอกได้ว่า tracking code ไหนมีอยู่จริงโดยไม่ต้องรู้ CID
// (เป็น enumeration oracle) — GET /api/cases/[id] ตั้งใจคืน 404 เหมือนกันหมดอยู่แล้ว
// ที่นี่จึงต้องเดินตามแบบเดียวกัน
const WITHDRAW_DENIED = { error: 'ไม่พบเรื่องที่ระบุ หรือข้อมูลไม่ตรงกับเจ้าของเรื่อง' };

export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers);

  // § Rate limit — 5 requests / 10 minutes (ถี่เกินไป = น่าสงสัย)
  // failOpen: false — endpoint นี้ยืนยันตัวตนด้วย trackingCode + CID และทำงานทำลายข้อมูล
  // (ถอนความยินยอม) ถ้า Redis ล่มแล้วปล่อยผ่าน = เดา CID ได้ไม่จำกัด นับเป็น auth path
  // (บังคับที่ RATE_LIMIT_POLICIES.consentWithdraw)
  const rateLimit = await enforceRateLimit('consentWithdraw', ip);
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

  // § ทางถอนแบบ LIFF — ผู้ใช้ที่แจ้งผ่าน LINE ไม่มี CID ในระบบ (D1) จึงยืนยันความ
  // เป็นเจ้าของเคสด้วย liff session cookie แทน
  const liffSession = readLiffSessionValue(req.cookies.get(LIFF_SESSION_COOKIE)?.value);
  let trackingCode: string;
  let proof: OwnershipProof;
  if (liffSession) {
    const validation = validateOrError(consentWithdrawLineSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    trackingCode = validation.data.trackingCode;
    proof = { kind: 'line', lineUserId: liffSession.lineUserId };
  } else {
    const validation = validateOrError(consentWithdrawSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    trackingCode = validation.data.trackingCode;
    proof = { kind: 'cid', cid: validation.data.cid };
  }

  const result = await withdrawCaseConsent(trackingCode, proof, {
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') || undefined,
  });
  if (!result.ok) {
    return NextResponse.json(WITHDRAW_DENIED, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: 'ถอนความยินยอมเรียบร้อย — ข้อมูลของคุณจะไม่สามารถเข้าถึงได้ผ่านระบบติดตามเรื่อง',
  });
}
