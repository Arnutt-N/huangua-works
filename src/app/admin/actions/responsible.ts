'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { cases, departments, legacyResponsibleMap, users } from '@/lib/db/schema';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { requireStaff } from '@/lib/auth/require-staff';
import { STAFF_ROLES, SUPERADMIN_ONLY } from '@/lib/auth/roles';
import { responsibleFormSchema, validateFormData } from '@/lib/validation';

/**
 * Server actions สำหรับ mapping ผู้รับผิดชอบย้อนหลัง (/admin/responsible, superadmin เท่านั้น)
 *
 * ทุก action: requireStaff(SUPERADMIN_ONLY) → validate → DB update → audit → revalidate
 * ไม่ redirect หลัง mutation — หน้าไม่มี query state ให้เสีย แต่ dialog ปิดตัวเอง
 * ด้วย success (pattern เดียวกับ actions/master-data.ts)
 *
 * § raw เก็บแบบ trim แล้ว — importer เทียบด้วย trim เดียวกัน (ดู legacy-import.ts)
 * จึงต้องห้าม raw ที่ trim แล้วว่างหรือซ้ำ
 */

export interface ResponsibleActionState {
  error: string | null;
  success?: string;
}

const PATH = '/admin/responsible';

async function getMapRow(raw: string) {
  const db = await getDb();
  return firstOrUndefined(
    db.select().from(legacyResponsibleMap).where(eq(legacyResponsibleMap.raw, raw)).limit(1),
  );
}

async function checkDepartment(departmentId: string): Promise<string | null> {
  const db = await getDb();
  const dept = await firstOrUndefined(
    db.select({ id: departments.id }).from(departments).where(eq(departments.id, departmentId)).limit(1),
  );
  if (!dept) return 'ไม่พบหน่วยงานที่เลือก';
  return null;
}

async function checkAssignee(assignedTo: string | null): Promise<string | null> {
  if (!assignedTo) return null;
  const db = await getDb();
  const person = await firstOrUndefined(
    db.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, assignedTo)).limit(1),
  );
  if (!person || !person.isActive || !(STAFF_ROLES as readonly string[]).includes(person.role)) {
    return 'ไม่พบเจ้าหน้าที่ที่เลือก';
  }
  return null;
}

export async function addResponsible(
  _prevState: ResponsibleActionState,
  formData: FormData,
): Promise<ResponsibleActionState> {
  const { user: actor } = await requireStaff(SUPERADMIN_ONLY);

  const v = validateFormData(responsibleFormSchema, formData);
  if (!v.success) return { error: v.error };
  const raw = v.data.raw.trim();
  if (!raw) return { error: 'กรุณากรอกค่าดิบ' };
  const assignedTo = v.data.assignedTo && v.data.assignedTo !== '__none__' ? v.data.assignedTo : null;

  const deptError = await checkDepartment(v.data.departmentId);
  if (deptError) return { error: deptError };
  const assigneeError = await checkAssignee(assignedTo);
  if (assigneeError) return { error: assigneeError };

  const db = await getDb();
  const existing = await firstOrUndefined(
    db.select({ raw: legacyResponsibleMap.raw }).from(legacyResponsibleMap).where(eq(legacyResponsibleMap.raw, raw)).limit(1),
  );
  if (existing) return { error: 'มีค่าดิบนี้ในระบบแล้ว' };

  await db.insert(legacyResponsibleMap).values({
    raw,
    departmentId: v.data.departmentId,
    assignedTo,
    decidedBy: actor.id,
  });
  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.RESPONSIBLE_CREATE,
    resource: 'legacy_responsible_map',
    resourceId: raw,
    metadata: { departmentId: v.data.departmentId, assignedTo },
  });
  revalidatePath(PATH);
  return { error: null, success: 'เพิ่ม mapping แล้ว' };
}

export async function updateResponsible(
  _prevState: ResponsibleActionState,
  formData: FormData,
): Promise<ResponsibleActionState> {
  const { user: actor } = await requireStaff(SUPERADMIN_ONLY);

  const v = validateFormData(responsibleFormSchema, formData);
  if (!v.success) return { error: v.error };
  const raw = v.data.raw.trim();
  const assignedTo = v.data.assignedTo && v.data.assignedTo !== '__none__' ? v.data.assignedTo : null;

  const found = await getMapRow(raw);
  if (!found) return { error: 'ไม่พบ mapping นี้' };

  const deptError = await checkDepartment(v.data.departmentId);
  if (deptError) return { error: deptError };
  const assigneeError = await checkAssignee(assignedTo);
  if (assigneeError) return { error: assigneeError };

  const db = await getDb();
  await db
    .update(legacyResponsibleMap)
    .set({ departmentId: v.data.departmentId, assignedTo, decidedBy: actor.id, decidedAt: new Date() })
    .where(eq(legacyResponsibleMap.raw, raw));
  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.RESPONSIBLE_UPDATE,
    resource: 'legacy_responsible_map',
    resourceId: raw,
    metadata: { departmentId: v.data.departmentId, assignedTo },
  });
  revalidatePath(PATH);
  return { error: null, success: 'บันทึก mapping แล้ว' };
}

export async function toggleResponsibleActive(
  _prevState: ResponsibleActionState,
  formData: FormData,
): Promise<ResponsibleActionState> {
  const { user: actor } = await requireStaff(SUPERADMIN_ONLY);

  const raw = String(formData.get('raw') ?? '').trim();
  if (!raw) return { error: 'กรุณากรอกค่าดิบ' };
  const current = await getMapRow(raw);
  if (!current) return { error: 'ไม่พบ mapping นี้' };

  const next = !current.isActive;
  const db = await getDb();
  await db
    .update(legacyResponsibleMap)
    .set({ isActive: next, decidedBy: actor.id, decidedAt: new Date() })
    .where(eq(legacyResponsibleMap.raw, raw));
  await logAudit({
    userId: actor.id,
    action: next ? AUDIT_ACTIONS.RESPONSIBLE_ACTIVATE : AUDIT_ACTIONS.RESPONSIBLE_DEACTIVATE,
    resource: 'legacy_responsible_map',
    resourceId: raw,
  });
  revalidatePath(PATH);
  return { error: null, success: next ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว (แถวที่อ้างถึงค้าง blocked)' };
}

export async function deleteResponsible(
  _prevState: ResponsibleActionState,
  formData: FormData,
): Promise<ResponsibleActionState> {
  const { user: actor } = await requireStaff(SUPERADMIN_ONLY);

  const raw = String(formData.get('raw') ?? '').trim();
  if (!raw) return { error: 'กรุณากรอกค่าดิบ' };
  const target = await getMapRow(raw);
  if (!target) return { error: 'ไม่พบ mapping นี้' };

  // § ลบไม่ได้ถ้าเรื่องย้อนหลังอ้างถึง — ให้ปิดใช้งานแทน (pattern เดียวกับ master-data)
  const db = await getDb();
  const referenced = await firstOrUndefined(
    db.select({ id: cases.id }).from(cases).where(eq(cases.legacyResponsibleRaw, raw)).limit(1),
  );
  if (referenced) return { error: 'ลบ mapping นี้ไม่ได้ — มีเรื่องย้อนหลังอ้างถึงอยู่ ให้ปิดใช้งานแทน' };

  await db.delete(legacyResponsibleMap).where(eq(legacyResponsibleMap.raw, raw));
  await logAudit({
    userId: actor.id,
    action: AUDIT_ACTIONS.RESPONSIBLE_DELETE,
    resource: 'legacy_responsible_map',
    resourceId: raw,
  });
  revalidatePath(PATH);
  return { error: null, success: 'ลบ mapping แล้ว' };
}
