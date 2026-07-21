/**
 * GET /api/cases/[id] — ดูสถานะเรื่องแจ้งเหตุ (สำหรับ citizen track)
 *
 * [id] ตอนนี้คือ **trackingCode** (HN + 9 หลัก) ไม่ใช่ UUID PK
 * เพื่อไม่เปิดเผย UUID v7 ที่ timestamp-ordered และเดาได้
 *
 * ความปลอดภัย (PDPA):
 * - Rate limit 10 ครั้ง/5 นาทีต่อ IP — กัน brute force tracking code
 * - Tracking code เป็น random 30-bit + rate limit → คาดเดาไม่ได้ในทางปฏิบัติ
 * - Response ถอด PII ออกหมด: เหลือเฉพาะ สถานะ + หัวเรื่อง + หมวดหมู่ + ไทม์ไลน์
 *   (เอา ชื่อ/เบอร์/ที่อยู่/รายละเอียด/เอกสารแนบ/department/submitter/assignedOfficer ออก)
 * - 404 ทุกกรณีที่ไม่พบ (format ผิด / code ผิด / เคสเก่าไม่มี trackingCode) — ไม่บอกสาเหตุ เพื่อกัน enumeration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, caseUpdates, categories } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/upstash';
import { normalizeTrackingCode } from '@/lib/case-tracking';
import { hasConsent } from '@/lib/consent';
import { eq, and } from 'drizzle-orm';

const NOT_FOUND = { error: 'ไม่พบเรื่องนี้' };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

  // § Rate limit — 10 requests / 5 minutes per IP (fail-open เหมือน submit)
  const rateLimit = await checkRateLimit(`rate:track:${ip}`, 10, 300);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'ค้นหาถี่เกินไป กรุณารอ ' + rateLimit.reset + ' วินาที' },
      { status: 429 }
    );
  }

  // § Normalize tracking code (uppercase + strip whitespace/dashes)
  // format ผิด → คืน 404 ไม่ใช่ 400 เพื่อไม่เปิดเผยว่า format ผิด (กัน enumeration)
  const trackingCode = normalizeTrackingCode(rawId);
  if (!trackingCode) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const db = await getDb();

  // § Lookup ด้วย trackingCode แทน PK — ถ้าไม่พบ หรือเป็นเคสเก่า (trackingCode null) → 404
  const caseRecord = await firstOrUndefined(
    db.select().from(cases).where(eq(cases.trackingCode, trackingCode)).limit(1)
  );

  if (!caseRecord) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  // § PDPA: ถ้าเจ้าของเรื่องถอนความยินยอมแล้ว → คืน 404 เหมือนไม่พบ (กัน enumeration)
  if (caseRecord.submittedBy) {
    const consentActive = await hasConsent(caseRecord.submittedBy, 'data_collection');
    if (!consentActive) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
  }

  // § Fetch category (ไม่ fetch department/submitter/officer — PII/ไม่จำเป็นสำหรับ citizen)
  const category = await firstOrUndefined(
    db.select().from(categories).where(eq(categories.id, caseRecord.categoryId)).limit(1)
  );

  // § Fetch updates (public only — isPublic = true)
  const updates = await db
    .select()
    .from(caseUpdates)
    .where(and(eq(caseUpdates.caseId, caseRecord.id), eq(caseUpdates.isPublic, true)))
    .orderBy(caseUpdates.createdAt);

  // § Audit log
  await logAudit({
    action: 'view_case',
    resource: 'cases',
    resourceId: caseRecord.id,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') || undefined,
    metadata: { via: 'tracking_code' },
  });

  // § Response ถอด PII: เหลือ สถานะ + หัวเรื่อง + หมวด + ไทม์ไลน์
  return NextResponse.json({
    case: {
      id: caseRecord.id,
      createdAt: caseRecord.createdAt,
      updatedAt: caseRecord.updatedAt,
      status: caseRecord.status,
      priority: caseRecord.priority,
      title: caseRecord.title,
      dueDate: caseRecord.dueDate,
      closedAt: caseRecord.closedAt,
    },
    category: category ? { id: category.id, name: category.name, icon: category.icon } : null,
    updates: updates.map((u) => ({
      id: u.id,
      createdAt: u.createdAt,
      updateType: u.updateType,
      oldValue: u.oldValue,
      newValue: u.newValue,
      comment: u.comment,
    })),
  });
}
