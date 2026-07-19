/**
 * POST /api/cases/submit — รับเรื่องแจ้งเหตุจากประชาชน
 * Rate limit: 3 requests / 5 minutes per IP
 * Deduplication: 7 วัน sliding window (CID + title + description)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, categories, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { isValidCid } from '@/lib/cid-checksum';
import { checkDuplicate, recordDedupHash } from '@/lib/dedup';
import { logAudit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/upstash';
import { getFiscalYear } from '@/lib/thai-date';
import { generateTrackingCode } from '@/lib/case-tracking';
import { generateCidHash } from '@/lib/cid-hmac';
import { grantConsent, CONSENT_VERSION } from '@/lib/consent';
import { eq } from 'drizzle-orm';

interface SubmitRequest {
  cid: string;
  fullName: string;
  phoneNumber?: string;
  email?: string;

  categoryId: string;
  title: string;
  description: string;
  location: string;

  // § citizen ต้องยินยอม PDPA — เก็บหลักฐานความยินยอมทุกครั้ง (server-enforced)
  consent: boolean;

  attachments?: Array<{ url: string; type: string; size: number }>;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  // § Rate limit — 3 requests / 5 minutes
  const rateLimitKey = `rate:submit:${ip}`;
  const rateLimit = await checkRateLimit(rateLimitKey, 3, 300);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'ส่งเรื่องถี่เกินไป กรุณารอ ' + rateLimit.reset + ' วินาที' },
      { status: 429 }
    );
  }

  // § Parse body
  let body: SubmitRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { cid, fullName, phoneNumber, email, categoryId, title, description, location, attachments, consent } = body;

  // § Validate CID
  if (!isValidCid(cid)) {
    return NextResponse.json({ error: 'เลขบัตรประชาชนไม่ถูกต้อง' }, { status: 400 });
  }

  // § Validate required fields
  if (!fullName || !categoryId || !title || !description || !location) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
  }

  // § Consent enforcement — ปฏิเสธการส่งทันทีถ้าไม่ยินยอม PDPA (defense-in-depth นอกเหนือจาก UI gate)
  if (consent !== true) {
    return NextResponse.json({ error: 'กรุณายินยอมให้เก็บข้อมูลก่อนส่งเรื่อง' }, { status: 400 });
  }

  // § Check duplicate (7 วัน sliding window)
  const dupCheck = await checkDuplicate(cid, title, description);
  if (dupCheck.isDuplicate) {
    return NextResponse.json(
      {
        error: 'คุณเคยแจ้งเรื่องนี้ไปแล้วภายใน 7 วัน',
        existingCaseId: dupCheck.caseId,
      },
      { status: 409 }
    );
  }

  const db = await getDb();

  // § Verify category exists
  const category = await firstOrUndefined(
    db.select().from(categories).where(eq(categories.id, categoryId)).limit(1)
  );
  if (!category) {
    return NextResponse.json({ error: 'หมวดหมู่ไม่ถูกต้อง' }, { status: 400 });
  }

  // § Find or create citizen user
  // § ไม่ฝัง plaintext CID ใน email — ใช้ HMAC hash แทน (PDPA: CID ห้ามรั่วไหลใน identifier ที่อาจถูก log/แสดง)
  const citizenEmail = email || `cid-${generateCidHash(cid)}@placeholder.local`;
  let citizenUser = await firstOrUndefined(
    db.select().from(users).where(eq(users.email, citizenEmail)).limit(1)
  );

  if (!citizenUser) {
    const userId = generateId();
    await db.insert(users).values({
      id: userId,
      email: citizenEmail,
      role: 'citizen',
      isActive: true,
      fullName,
      phoneNumber,
      // § เลิกเก็บ plaintext CID ใน metadata — CID เก็บเฉพาะในรูป HMAC (dedup_hashes) เท่านั้น
      metadata: JSON.stringify({ source: 'web_intake' }),
    });

    citizenUser = await firstOrUndefined(
      db.select().from(users).where(eq(users.id, userId)).limit(1)
    );
  }

  if (!citizenUser) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }

  // § บันทึกหลักฐานความยินยอม PDPA — เก็บทุกครั้งที่ส่งเรื่อง (เป็น audit trail ที่ hasConsent จะอ่านภายหลัง)
  await grantConsent({
    userId: citizenUser.id,
    consentType: 'data_collection',
    version: CONSENT_VERSION,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') || undefined,
    metadata: { via: 'intake_submit' },
  });

  // § Create case
  const caseId = generateId();
  const fiscalYear = getFiscalYear(new Date());
  const dueDate = new Date(Date.now() + (category.estimatedDays || 7) * 24 * 60 * 60 * 1000);

  // § Generate tracking code (HN + 9 หลัก) — วนจนได้ code ที่ไม่ชนกับเคสเดิม
  // collision เกือบเป็นไปไม่ได้ที่ 10^9 ค่า แต่เช็กเผื่อเพื่อความถูกต้อง
  let trackingCode = generateTrackingCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const collision = await firstOrUndefined(
      db.select({ id: cases.id }).from(cases).where(eq(cases.trackingCode, trackingCode)).limit(1)
    );
    if (!collision) break;
    trackingCode = generateTrackingCode();
  }

  await db.insert(cases).values({
    id: caseId,
    status: 'received',
    priority: 'normal',
    title,
    description,
    location,
    categoryId,
    submittedBy: citizenUser.id,
    departmentId: category.defaultDepartmentId || null,
    dueDate,
    attachments: attachments ? JSON.stringify(attachments) : null,
    metadata: JSON.stringify({
      fiscalYear,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') || 'unknown',
    }),
    trackingCode,
  });

  // § Record dedup hash
  await recordDedupHash(cid, title, description, caseId);

  // § Audit log
  await logAudit({
    userId: citizenUser.id,
    action: 'submit_case',
    resource: 'cases',
    resourceId: caseId,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') || undefined,
    metadata: { categoryId, fiscalYear },
  });

  return NextResponse.json(
    {
      success: true,
      caseId,
      trackingCode,
      message: 'รับเรื่องเรียบร้อย — เจ้าหน้าที่จะติดตามภายใน ' + (category.estimatedDays || 7) + ' วัน',
    },
    { status: 201 }
  );
}
