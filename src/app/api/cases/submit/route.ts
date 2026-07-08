/**
 * POST /api/cases/submit — รับเรื่องร้องเรียก/ร้องทุกข์จากประชาชน
 * Rate limit: 3 requests / 5 minutes per IP
 * Deduplication: 7 วัน sliding window (CID + title + description)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, categories, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { isValidCid } from '@/lib/cid-checksum';
import { checkDuplicate, recordDedupHash } from '@/lib/dedup';
import { logAudit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/upstash';
import { getFiscalYear } from '@/lib/thai-date';
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

  const { cid, fullName, phoneNumber, email, categoryId, title, description, location, attachments } = body;

  // § Validate CID
  if (!isValidCid(cid)) {
    return NextResponse.json({ error: 'เลขบัตรประชาชนไม่ถูกต้อง' }, { status: 400 });
  }

  // § Validate required fields
  if (!fullName || !categoryId || !title || !description || !location) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
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

  const db = getDb();

  // § Verify category exists
  const category = await db.select().from(categories).where(eq(categories.id, categoryId)).get();
  if (!category) {
    return NextResponse.json({ error: 'หมวดหมู่ไม่ถูกต้อง' }, { status: 400 });
  }

  // § Find or create citizen user
  let citizenUser = await db.select().from(users).where(eq(users.email, email || `cid-${cid}@placeholder.local`)).get();

  if (!citizenUser) {
    const userId = generateId();
    await db.insert(users).values({
      id: userId,
      email: email || `cid-${cid}@placeholder.local`,
      role: 'citizen',
      isActive: true,
      fullName,
      phoneNumber,
      metadata: JSON.stringify({ cid, source: 'web_intake' }),
    });

    citizenUser = await db.select().from(users).where(eq(users.id, userId)).get();
  }

  if (!citizenUser) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }

  // § Create case
  const caseId = generateId();
  const fiscalYear = getFiscalYear(new Date());
  const dueDate = new Date(Date.now() + (category.estimatedDays || 7) * 24 * 60 * 60 * 1000);

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
      message: 'รับเรื่องเรียบร้อย — เจ้าหน้าที่จะติดตามภายใน ' + (category.estimatedDays || 7) + ' วัน',
    },
    { status: 201 }
  );
}
