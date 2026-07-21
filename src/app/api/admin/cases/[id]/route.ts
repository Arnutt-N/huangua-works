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
import { patchCaseSchema, validateOrError } from '@/lib/validation';

// § supervisor-only fields — ต้องตรงกับ server action `changeDepartment`
// (officer ย้ายข้ามหน่วยงานไม่ได้ — ป้องกัน Broken Access Control ผ่าน alternative path)
const SUPERVISOR_ROLES = ['chief', 'head', 'superadmin'] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, ipAddress, userAgent } = await requireStaff();
  const { id: caseId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  // § validate ด้วย zod (แทน manual VALID_STATUSES.includes + priority check)
  const validation = validateOrError(patchCaseSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const validated = validation.data;

  // § role check สำหรับ departmentId — ต้องตรงกับ server action `changeDepartment`
  // ที่เรียก requireStaff(['chief','head','superadmin'])
  // ถ้าไม่เช็คที่นี่ officer จะ bypass authorization ผ่าน PATCH API ได้
  // (zod validate shape ของข้อมูล, role check เป็น authorization layer แยก)
  if (
    validated.departmentId !== undefined &&
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
  if (validated.status && validated.status !== current.status) {
    const transition = assertTransition(current.status as CaseStatus, validated.status);
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

      if (validated.status && validated.status !== current.status) {
        updateSet.status = validated.status;
        const isClosing = validated.status === 'closed' || validated.status === 'done';
        const isRejected = validated.status === 'rejected';
        if (isClosing || isRejected) updateSet.closedAt = now;
        changes.status = { from: current.status, to: validated.status };

        await tx.insert(caseUpdates).values({
          id: generateId(),
          caseId,
          userId: user.id,
          updateType: 'status_change',
          oldValue: current.status,
          newValue: validated.status,
          isPublic: true,
        });
      }

      if (validated.assignedTo !== undefined && validated.assignedTo !== current.assignedTo) {
        updateSet.assignedTo = validated.assignedTo;
        changes.assignedTo = {
          from: current.assignedTo ?? '(ยังไม่มอบหมาย)',
          to: validated.assignedTo ?? '(ยังไม่มอบหมาย)',
        };

        await tx.insert(caseUpdates).values({
          id: generateId(),
          caseId,
          userId: user.id,
          updateType: 'assignment',
          oldValue: current.assignedTo ?? '(ยังไม่มอบหมาย)',
          newValue: validated.assignedTo ?? '(ยังไม่มอบหมาย)',
          isPublic: true,
        });
      }

      if (
        validated.departmentId !== undefined &&
        validated.departmentId !== current.departmentId
      ) {
        updateSet.departmentId = validated.departmentId;
        changes.departmentId = {
          from: current.departmentId ?? '(ไม่ระบุ)',
          to: validated.departmentId ?? '(ไม่ระบุ)',
        };

        await tx.insert(caseUpdates).values({
          id: generateId(),
          caseId,
          userId: user.id,
          updateType: 'metadata_change',
          oldValue: current.departmentId ?? '(ไม่ระบุ)',
          newValue: validated.departmentId ?? '(ไม่ระบุ)',
          comment: 'เปลี่ยนหน่วยงานที่รับผิดชอบ',
          isPublic: true,
        });
      }

      if (validated.priority && validated.priority !== current.priority) {
        updateSet.priority = validated.priority;
        changes.priority = { from: current.priority, to: validated.priority };

        await tx.insert(caseUpdates).values({
          id: generateId(),
          caseId,
          userId: user.id,
          updateType: 'metadata_change',
          oldValue: current.priority,
          newValue: validated.priority,
          comment: validated.priority === 'urgent' ? 'ปรับเป็นเรื่องด่วน' : 'ปรับเป็นเรื่องปกติ',
          isPublic: true,
        });
      }

      if (validated.comment) {
        await tx.insert(caseUpdates).values({
          id: generateId(),
          caseId,
          userId: user.id,
          updateType: 'comment',
          comment: validated.comment,
          isPublic: true,
        });
        changes.comment = { from: null, to: validated.comment.length };
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
