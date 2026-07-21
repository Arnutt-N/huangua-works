'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, caseUpdates } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';
import { generateId } from '@/lib/id';
import { requireStaff } from '@/lib/auth/require-staff';
import {
  assertTransition,
  STATUS_LABELS_TH,
  type CaseStatus,
} from '@/lib/cases/state-machine';
import {
  changeStatusFormSchema,
  assignOfficerFormSchema,
  changeDepartmentFormSchema,
  setPriorityFormSchema,
  addUpdateFormSchema,
  validateFormData,
} from '@/lib/validation';

/**
 * Server actions สำหรับจัดการเคสจากหน้า /admin/cases/[id]
 *
 * ทุก action:
 *  1. requireStaff() — auth + role/isActive re-check (defense-in-depth)
 *  2. validate input (basic — zod จะตามมาใน PR #4)
 *  3. db.transaction — atomic update (cases + case_updates + audit_log)
 *  4. revalidatePath — refresh cache
 *
 * สถานะปัจจุบัน:
 *  - action-level error คืน { error } ให้ useActionState แสดงใน UI
 *  - สำเร็จ redirect กลับ detail page (ซึ่ง revalidatePath จะ refresh ข้อมูล)
 */

export interface CaseActionState {
  error: string | null;
  success?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. เปลี่ยนสถานะ
// ────────────────────────────────────────────────────────────────────────────

export async function changeStatus(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const { user, ipAddress, userAgent } = await requireStaff();

  // § validate ด้วย zod (แทน typeof checks)
  const v = validateFormData(changeStatusFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, status: newStatus, comment, isPublic } = v.data;

  const db = await getDb();

  // fetch current case เพื่อตรวจ transition
  const current = await firstOrUndefined(
    db
      .select({ id: cases.id, status: cases.status, title: cases.title })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1)
  );

  if (!current) {
    return { error: 'ไม่พบเรื่องที่ระบุ' };
  }

  const transition = assertTransition(current.status as CaseStatus, newStatus);
  if (!transition.ok) {
    return { error: transition.reason ?? 'การเปลี่ยนสถานะไม่ถูกต้อง' };
  }

  const now = new Date();
  const isClosing = newStatus === 'closed' || newStatus === 'done';
  const isRejected = newStatus === 'rejected';

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({
          status: newStatus,
          updatedAt: now,
          closedAt: isClosing || isRejected ? now : null,
        })
        .where(eq(cases.id, caseId));

      await tx.insert(caseUpdates).values({
        id: generateId(),
        caseId,
        userId: user.id,
        updateType: 'status_change',
        oldValue: current.status,
        newValue: newStatus,
        comment,
        isPublic: isPublic === 'true',
      });

      await logAudit({
        userId: user.id,
        action: 'update_case_status',
        resource: 'cases',
        resourceId: caseId,
        ipAddress,
        userAgent,
        metadata: {
          title: current.title,
          from: current.status,
          to: newStatus,
        },
      });
    });
  } catch (err) {
    console.error('[changeStatus] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง' };
  }

  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath('/admin');

  redirect(`/admin/cases/${caseId}?ok=status`);
}

// ────────────────────────────────────────────────────────────────────────────
// 2. มอบหมายเจ้าหน้าที่ (หรือยกเลิกการมอบหมาย)
// ────────────────────────────────────────────────────────────────────────────

export async function assignOfficer(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const { user, ipAddress, userAgent } = await requireStaff();

  const v = validateFormData(assignOfficerFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, officerId } = v.data;

  const db = await getDb();

  const current = await firstOrUndefined(
    db
      .select({ id: cases.id, assignedTo: cases.assignedTo, title: cases.title })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1)
  );

  if (!current) {
    return { error: 'ไม่พบเรื่องที่ระบุ' };
  }

  const newAssignedTo = officerId === '__unassign__' ? null : officerId;
  const oldValue = current.assignedTo ?? '(ยังไม่มอบหมาย)';
  const newValue = newAssignedTo ?? '(ยังไม่มอบหมาย)';

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({
          assignedTo: newAssignedTo,
          updatedAt: new Date(),
        })
        .where(eq(cases.id, caseId));

      await tx.insert(caseUpdates).values({
        id: generateId(),
        caseId,
        userId: user.id,
        updateType: 'assignment',
        oldValue: String(oldValue),
        newValue: String(newValue),
        isPublic: true,
      });

      await logAudit({
        userId: user.id,
        action: 'assign_case',
        resource: 'cases',
        resourceId: caseId,
        ipAddress,
        userAgent,
        metadata: {
          title: current.title,
          from: oldValue,
          to: newValue,
        },
      });
    });
  } catch (err) {
    console.error('[assignOfficer] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง' };
  }

  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath('/admin');

  redirect(`/admin/cases/${caseId}?ok=assign`);
}

// ────────────────────────────────────────────────────────────────────────────
// 3. เปลี่ยนหน่วยงาน (chief/head/superadmin เท่านั้น)
// ────────────────────────────────────────────────────────────────────────────

export async function changeDepartment(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  // เฉพาะ supervisor roles เท่านั้นที่เปลี่ยนหน่วยงานได้ (officer ย้ายข้ามไม่ได้)
  const { user, ipAddress, userAgent } = await requireStaff([
    'chief',
    'head',
    'superadmin',
  ]);

  const v = validateFormData(changeDepartmentFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, departmentId } = v.data;

  const db = await getDb();

  const current = await firstOrUndefined(
    db
      .select({ id: cases.id, departmentId: cases.departmentId, title: cases.title })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1)
  );

  if (!current) {
    return { error: 'ไม่พบเรื่องที่ระบุ' };
  }

  const newDept = departmentId === '__unset__' ? null : departmentId;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({
          departmentId: newDept,
          updatedAt: new Date(),
        })
        .where(eq(cases.id, caseId));

      await tx.insert(caseUpdates).values({
        id: generateId(),
        caseId,
        userId: user.id,
        updateType: 'metadata_change',
        oldValue: current.departmentId ?? '(ไม่ระบุ)',
        newValue: newDept ?? '(ไม่ระบุ)',
        comment: 'เปลี่ยนหน่วยงานที่รับผิดชอบ',
        isPublic: true,
      });

      await logAudit({
        userId: user.id,
        action: 'change_case_department',
        resource: 'cases',
        resourceId: caseId,
        ipAddress,
        userAgent,
        metadata: {
          title: current.title,
          from: current.departmentId,
          to: newDept,
        },
      });
    });
  } catch (err) {
    console.error('[changeDepartment] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง' };
  }

  revalidatePath(`/admin/cases/${caseId}`);

  redirect(`/admin/cases/${caseId}?ok=department`);
}

// ────────────────────────────────────────────────────────────────────────────
// 4. เปลี่ยนความเร่งด่วน (normal ↔ urgent)
// ────────────────────────────────────────────────────────────────────────────

export async function setPriority(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const { user, ipAddress, userAgent } = await requireStaff();

  const v = validateFormData(setPriorityFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, priority } = v.data;

  const db = await getDb();

  const current = await firstOrUndefined(
    db
      .select({ id: cases.id, priority: cases.priority, title: cases.title })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1)
  );

  if (!current) {
    return { error: 'ไม่พบเรื่องที่ระบุ' };
  }

  if (current.priority === priority) {
    return { error: 'ความเร่งด่วนเหมือนเดิม' };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({
          priority,
          updatedAt: new Date(),
        })
        .where(eq(cases.id, caseId));

      await tx.insert(caseUpdates).values({
        id: generateId(),
        caseId,
        userId: user.id,
        updateType: 'metadata_change',
        oldValue: current.priority,
        newValue: priority,
        comment: priority === 'urgent' ? 'ปรับเป็นเรื่องด่วน' : 'ปรับเป็นเรื่องปกติ',
        isPublic: true,
      });

      await logAudit({
        userId: user.id,
        action: 'update_case_priority',
        resource: 'cases',
        resourceId: caseId,
        ipAddress,
        userAgent,
        metadata: {
          title: current.title,
          from: current.priority,
          to: priority,
        },
      });
    });
  } catch (err) {
    console.error('[setPriority] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง' };
  }

  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath('/admin');

  redirect(`/admin/cases/${caseId}?ok=priority`);
}

// ────────────────────────────────────────────────────────────────────────────
// 5. เพิ่มความคืบหน้า (comment)
// ────────────────────────────────────────────────────────────────────────────

export async function addUpdate(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const { user, ipAddress, userAgent } = await requireStaff();

  const v = validateFormData(addUpdateFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { caseId, comment: trimmed, isPublic } = v.data;

  // § comment ถูก trim + length-check โดย zod แล้ว (commentSchema)
  const db = await getDb();

  const current = await firstOrUndefined(
    db
      .select({ id: cases.id, title: cases.title })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1)
  );

  if (!current) {
    return { error: 'ไม่พบเรื่องที่ระบุ' };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({ updatedAt: new Date() })
        .where(eq(cases.id, caseId));

      await tx.insert(caseUpdates).values({
        id: generateId(),
        caseId,
        userId: user.id,
        updateType: 'comment',
        comment: trimmed,
        isPublic: isPublic !== 'false', // default public
      });

      await logAudit({
        userId: user.id,
        action: 'add_case_comment',
        resource: 'cases',
        resourceId: caseId,
        ipAddress,
        userAgent,
        metadata: {
          title: current.title,
          isPublic: isPublic !== 'false',
          length: trimmed.length,
        },
      });
    });
  } catch (err) {
    console.error('[addUpdate] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง' };
  }

  revalidatePath(`/admin/cases/${caseId}`);

  redirect(`/admin/cases/${caseId}?ok=comment`);
}

// ────────────────────────────────────────────────────────────────────────────
// helper: แปลง status enum เป็น label ไทย (export สำหรับ UI)
// ────────────────────────────────────────────────────────────────────────────

export { STATUS_LABELS_TH };
