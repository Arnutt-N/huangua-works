/**
 * PATCH /api/admin/cases/[id] — อัปเดตเคสจากแผงเจ้าหน้าที่
 *
 * แยกจาก citizen endpoint `/api/cases/[id]` (GET-only, trackingCode-keyed, PII-stripped)
 * เพราะ:
 *  - admin ใช้ UUID id (ไม่ใช่ trackingCode)
 *  - admin ต้อง auth + role check
 *  - admin เห็นข้อมูลเต็ม
 *
 * รองรับการอัปเดต field เดียวหรือหลาย field พร้อมกัน
 *
 * Body (JSON, ทุก field optional — อัปเดตเฉพาะที่ส่งมา):
 * {
 *   status?: CaseStatus,
 *   assignedTo?: string | null,  // null = unassign
 *   departmentId?: string | null,
 *   priority?: 'normal' | 'urgent',
 *   comment?: string             // optional, เพิ่ม timeline entry
 * }
 *
 * Auth: requireStaff() — same defense-in-depth pattern เป็นหน้า admin
 * Audit: logAudit + case_updates insert สำหรับทุกการเปลี่ยนแปลง
 *
 * Note: Server actions (admin/actions/cases.ts) เป็น primary path สำหรับ UI;
 * PATCH API นี้เป็นทางเลือกสำหรับ programmatic/scripted access หรือ AJAX ในอนาคต
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, caseUpdates } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';
import { generateId } from '@/lib/id';
import { requireStaff } from '@/lib/auth/require-staff';
import { assertTransition, type CaseStatus } from '@/lib/cases/state-machine';

interface PatchBody {
  status?: CaseStatus;
  assignedTo?: string | null;
  departmentId?: string | null;
  priority?: 'normal' | 'urgent';
  comment?: string;
}

const VALID_STATUSES: CaseStatus[] = [
  'received',
  'reviewing',
  'assigned',
  'in_progress',
  'done',
  'closed',
  'rejected',
];

// § supervisor-only fields — ต้องตรงกับ server action `changeDepartment`
// (officer ย้ายข้ามหน่วยงานไม่ได้ — ป้องกัน Broken Access Control ผ่าน alternative path)
const SUPERVISOR_ROLES = ['chief', 'head', 'superadmin'] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, ipAddress, userAgent } = await requireStaff();
  const { id: caseId } = await params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (
    body.status !== undefined &&
    !VALID_STATUSES.includes(body.status)
  ) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }
  if (
    body.priority !== undefined &&
    body.priority !== 'normal' &&
    body.priority !== 'urgent'
  ) {
    return NextResponse.json({ error: 'invalid priority' }, { status: 400 });
  }

  // § role check สำหรับ departmentId — ต้องตรงกับ server action `changeDepartment`
  // ที่เรียก requireStaff(['chief','head','superadmin'])
  // ถ้าไม่เช็คที่นี่ officer จะ bypass authorization ผ่าน PATCH API ได้
  if (
    body.departmentId !== undefined &&
    !SUPERVISOR_ROLES.includes(user.role as (typeof SUPERVISOR_ROLES)[number])
  ) {
    await logAudit({
      userId: user.id,
      action: 'access_denied',
      resource: 'cases',
      resourceId: caseId,
      ipAddress,
      userAgent,
      metadata: {
        reason: 'insufficient_role_for_department_change',
        role: user.role,
        required: SUPERVISOR_ROLES,
      },
    });
    return NextResponse.json(
      { error: 'เปลี่ยนหน่วยงานต้องการสิทธิ supervisor (chief/head/superadmin)' },
      { status: 403 }
    );
  }

  const db = await getDb();

  const current = await firstOrUndefined(
    db
      .select({
        id: cases.id,
        status: cases.status,
        priority: cases.priority,
        assignedTo: cases.assignedTo,
        departmentId: cases.departmentId,
        title: cases.title,
      })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1)
  );

  if (!current) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  // validate state transition if status change requested
  if (body.status && body.status !== current.status) {
    const transition = assertTransition(current.status as CaseStatus, body.status);
    if (!transition.ok) {
      return NextResponse.json(
        { error: transition.reason ?? 'invalid transition' },
        { status: 409 }
      );
    }
  }

  const now = new Date();
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  try {
    await db.transaction(async (tx) => {
      const updateSet: Partial<typeof cases.$inferInsert> = { updatedAt: now };

      if (body.status && body.status !== current.status) {
        updateSet.status = body.status;
        const isClosing = body.status === 'closed' || body.status === 'done';
        const isRejected = body.status === 'rejected';
        if (isClosing || isRejected) updateSet.closedAt = now;
        changes.status = { from: current.status, to: body.status };

        await tx.insert(caseUpdates).values({
          id: generateId(),
          caseId,
          userId: user.id,
          updateType: 'status_change',
          oldValue: current.status,
          newValue: body.status,
          isPublic: true,
        });
      }

      if (body.assignedTo !== undefined && body.assignedTo !== current.assignedTo) {
        updateSet.assignedTo = body.assignedTo;
        changes.assignedTo = {
          from: current.assignedTo ?? '(ยังไม่มอบหมาย)',
          to: body.assignedTo ?? '(ยังไม่มอบหมาย)',
        };

        await tx.insert(caseUpdates).values({
          id: generateId(),
          caseId,
          userId: user.id,
          updateType: 'assignment',
          oldValue: current.assignedTo ?? '(ยังไม่มอบหมาย)',
          newValue: body.assignedTo ?? '(ยังไม่มอบหมาย)',
          isPublic: true,
        });
      }

      if (
        body.departmentId !== undefined &&
        body.departmentId !== current.departmentId
      ) {
        updateSet.departmentId = body.departmentId;
        changes.departmentId = {
          from: current.departmentId ?? '(ไม่ระบุ)',
          to: body.departmentId ?? '(ไม่ระบุ)',
        };

        await tx.insert(caseUpdates).values({
          id: generateId(),
          caseId,
          userId: user.id,
          updateType: 'metadata_change',
          oldValue: current.departmentId ?? '(ไม่ระบุ)',
          newValue: body.departmentId ?? '(ไม่ระบุ)',
          comment: 'เปลี่ยนหน่วยงานที่รับผิดชอบ',
          isPublic: true,
        });
      }

      if (body.priority && body.priority !== current.priority) {
        updateSet.priority = body.priority;
        changes.priority = { from: current.priority, to: body.priority };

        await tx.insert(caseUpdates).values({
          id: generateId(),
          caseId,
          userId: user.id,
          updateType: 'metadata_change',
          oldValue: current.priority,
          newValue: body.priority,
          comment: body.priority === 'urgent' ? 'ปรับเป็นเรื่องด่วน' : 'ปรับเป็นเรื่องปกติ',
          isPublic: true,
        });
      }

      if (body.comment && body.comment.trim()) {
        const trimmed = body.comment.trim().slice(0, 2000);
        await tx.insert(caseUpdates).values({
          id: generateId(),
          caseId,
          userId: user.id,
          updateType: 'comment',
          comment: trimmed,
          isPublic: true,
        });
        changes.comment = { from: null, to: trimmed.length };
      }

      // only UPDATE if there are field changes (avoid no-op write)
      if (Object.keys(updateSet).length > 1) {
        await tx.update(cases).set(updateSet).where(eq(cases.id, caseId));
      }

      await logAudit({
        userId: user.id,
        action: 'patch_case',
        resource: 'cases',
        resourceId: caseId,
        ipAddress,
        userAgent,
        metadata: {
          title: current.title,
          changes,
        },
      });
    });
  } catch (err) {
    console.error('[PATCH /api/admin/cases/[id]] failed', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึก' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    caseId,
    changes: Object.keys(changes),
  });
}
