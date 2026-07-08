/**
 * GET /api/cases/[id] — ดูรายละเอียดเรื่องร้องเรียก (สำหรับประชาชน + เจ้าหน้าที่)
 * Public endpoint (ไม่ต้อง auth สำหรับตอนนี้ — citizen ดูเรื่องของตัวเองได้)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cases, caseUpdates, users, categories, departments } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';
import { eq, and } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  // § Fetch case
  const caseRecord = await db.select().from(cases).where(eq(cases.id, id)).get();

  if (!caseRecord) {
    return NextResponse.json({ error: 'ไม่พบเรื่องนี้' }, { status: 404 });
  }

  // § Fetch related data
  const submitter = await db.select().from(users).where(eq(users.id, caseRecord.submittedBy)).get();
  const category = await db.select().from(categories).where(eq(categories.id, caseRecord.categoryId)).get();
  const department = caseRecord.departmentId
    ? await db.select().from(departments).where(eq(departments.id, caseRecord.departmentId)).get()
    : null;
  const assignedOfficer = caseRecord.assignedTo
    ? await db.select().from(users).where(eq(users.id, caseRecord.assignedTo)).get()
    : null;

  // § Fetch updates (public only สำหรับ citizen)
  const updates = await db
    .select()
    .from(caseUpdates)
    .where(and(eq(caseUpdates.caseId, id), eq(caseUpdates.isPublic, true)))
    .orderBy(caseUpdates.createdAt)
    .all();

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
