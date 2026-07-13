/**
 * GET /api/cases/[id] — ดูรายละเอียดเรื่องร้องเรียก (สำหรับประชาชน + เจ้าหน้าที่)
 * Public endpoint (ไม่ต้อง auth สำหรับตอนนี้ — citizen ดูเรื่องของตัวเองได้)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, caseUpdates, users, categories, departments } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';
import { eq, and } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();

  // § Fetch case
  const caseRecord = await firstOrUndefined(
    db.select().from(cases).where(eq(cases.id, id)).limit(1)
  );

  if (!caseRecord) {
    return NextResponse.json({ error: 'ไม่พบเรื่องนี้' }, { status: 404 });
  }

  // § Fetch related data
  const submitter = await firstOrUndefined(
    db.select().from(users).where(eq(users.id, caseRecord.submittedBy)).limit(1)
  );
  const category = await firstOrUndefined(
    db.select().from(categories).where(eq(categories.id, caseRecord.categoryId)).limit(1)
  );
  const department = caseRecord.departmentId
    ? await firstOrUndefined(
        db.select().from(departments).where(eq(departments.id, caseRecord.departmentId)).limit(1)
      )
    : null;
  const assignedOfficer = caseRecord.assignedTo
    ? await firstOrUndefined(
        db.select().from(users).where(eq(users.id, caseRecord.assignedTo)).limit(1)
      )
    : null;

  // § Fetch updates (public only สำหรับ citizen)
  const updates = await db
    .select()
    .from(caseUpdates)
    .where(and(eq(caseUpdates.caseId, id), eq(caseUpdates.isPublic, true)))
    .orderBy(caseUpdates.createdAt);

  // § Audit log
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  await logAudit({
    action: 'view_case',
    resource: 'cases',
    resourceId: id,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') || undefined,
  });

  return NextResponse.json({
    case: {
      id: caseRecord.id,
      createdAt: caseRecord.createdAt,
      updatedAt: caseRecord.updatedAt,
      status: caseRecord.status,
      priority: caseRecord.priority,
      title: caseRecord.title,
      description: caseRecord.description,
      location: caseRecord.location,
      dueDate: caseRecord.dueDate,
      closedAt: caseRecord.closedAt,
      attachments: caseRecord.attachments ? JSON.parse(caseRecord.attachments as string) : [],
    },
    category: category ? { id: category.id, name: category.name, icon: category.icon } : null,
    department: department ? { id: department.id, name: department.name, icon: department.icon } : null,
    submitter: submitter
      ? { id: submitter.id, fullName: submitter.fullName, phoneNumber: submitter.phoneNumber }
      : null,
    assignedOfficer: assignedOfficer ? { id: assignedOfficer.id, fullName: assignedOfficer.fullName } : null,
    updates: updates.map((u) => ({
      id: u.id,
      createdAt: u.createdAt,
      updateType: u.updateType,
      oldValue: u.oldValue,
      newValue: u.newValue,
      comment: u.comment,
      attachments: u.attachments ? JSON.parse(u.attachments as string) : [],
    })),
  });
}
