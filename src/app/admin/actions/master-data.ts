'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, ne, or } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { categories, departments } from '@/lib/db/schema';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { generateId } from '@/lib/id';
import { requireStaff } from '@/lib/auth/require-staff';
import {
  categoryFormSchema,
  departmentFormSchema,
  toggleActiveFormSchema,
  validateFormData,
} from '@/lib/validation';
import type { userRoleEnum } from '@/lib/db/schema';

type UserRole = (typeof userRoleEnum.enumValues)[number];

/**
 * Server actions สำหรับข้อมูลหลัก — หน่วยงาน (departments) และหมวดหมู่ (categories)
 *
 * สองตารางนี้เป็น "โครง" ที่ทุกเรื่องแจ้งอ้างถึง การแก้จึงกระทบทั้งระบบ
 * จำกัดสิทธิ์ head/superadmin เหมือน /admin/users
 *
 * § ไม่มีปุ่มลบถาวร — ใช้ปิดใช้งาน (isActive=false) แทน
 * cases.departmentId / cases.categoryId ชี้มาที่แถวเหล่านี้ ถ้าลบทิ้งเรื่องเก่าจะ
 * อ้างถึงของที่ไม่มีอยู่ และรายงานย้อนหลังจะอ่านไม่ออก การปิดใช้งานทำให้หมวดนั้น
 * หายจาก dropdown ของฟอร์มแจ้งเหตุ แต่เรื่องเดิมยังแสดงชื่อได้ถูกต้อง
 */

const SUPERVISOR_ROLES: UserRole[] = ['head', 'superadmin'];

export interface MasterDataActionState {
  error: string | null;
  success?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// หน่วยงาน
// ────────────────────────────────────────────────────────────────────────────

export async function saveDepartment(
  _prevState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(SUPERVISOR_ROLES);

  const v = validateFormData(departmentFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { id, name, slug, description } = v.data;

  const db = await getDb();

  // name และ slug เป็น unique ทั้งคู่ — เช็คก่อนเพื่อคืนข้อความไทยแทน error ของ Postgres
  // ตอนแก้ไขต้องยกเว้นแถวตัวเอง ไม่งั้นบันทึกทับตัวเองไม่ได้
  const clash = await firstOrUndefined(
    db
      .select({ id: departments.id })
      .from(departments)
      .where(
        id
          ? and(
              or(eq(departments.name, name), eq(departments.slug, slug)),
              ne(departments.id, id),
            )
          : or(eq(departments.name, name), eq(departments.slug, slug)),
      )
      .limit(1),
  );
  if (clash) return { error: 'มีหน่วยงานที่ใช้ชื่อหรือ slug นี้แล้ว' };

  try {
    if (id) {
      await db
        .update(departments)
        .set({ name, slug, description: description || null })
        .where(eq(departments.id, id));
    } else {
      await db.insert(departments).values({
        id: generateId(),
        name,
        slug,
        description: description || null,
      });
    }
    await logAudit({
      userId: actor.id,
      action: id ? AUDIT_ACTIONS.DEPARTMENT_UPDATE : AUDIT_ACTIONS.DEPARTMENT_CREATE,
      resource: 'departments',
      resourceId: id,
      ipAddress,
      userAgent,
      metadata: { name, slug },
    });
  } catch {
    return { error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' };
  }

  revalidatePath('/admin/master-data');
  return { error: null, success: id ? 'แก้ไขหน่วยงานเรียบร้อย' : 'เพิ่มหน่วยงานเรียบร้อย' };
}

// ────────────────────────────────────────────────────────────────────────────
// หมวดหมู่
// ────────────────────────────────────────────────────────────────────────────

export async function saveCategory(
  _prevState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(SUPERVISOR_ROLES);

  const v = validateFormData(categoryFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { id, name, slug, description, defaultDepartmentId, estimatedDays } = v.data;

  const db = await getDb();

  const clash = await firstOrUndefined(
    db
      .select({ id: categories.id })
      .from(categories)
      .where(
        id
          ? and(
              or(eq(categories.name, name), eq(categories.slug, slug)),
              ne(categories.id, id),
            )
          : or(eq(categories.name, name), eq(categories.slug, slug)),
      )
      .limit(1),
  );
  if (clash) return { error: 'มีหมวดหมู่ที่ใช้ชื่อหรือ slug นี้แล้ว' };

  const deptValue =
    defaultDepartmentId && defaultDepartmentId !== '__none__' ? defaultDepartmentId : null;

  // § ตรวจว่าหน่วยงานที่อ้างมีจริง — categories.default_department_id ไม่มี FK constraint
  // ในสคีมา ถ้าไม่ตรวจจะบันทึก id ที่ไม่มีอยู่ได้และหน้าอื่นจะ join ไม่เจอเงียบ ๆ
  if (deptValue) {
    const dept = await firstOrUndefined(
      db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.id, deptValue))
        .limit(1),
    );
    if (!dept) return { error: 'ไม่พบหน่วยงานที่เลือก' };
  }

  try {
    if (id) {
      await db
        .update(categories)
        .set({
          name,
          slug,
          description: description || null,
          defaultDepartmentId: deptValue,
          estimatedDays,
        })
        .where(eq(categories.id, id));
    } else {
      await db.insert(categories).values({
        id: generateId(),
        name,
        slug,
        description: description || null,
        defaultDepartmentId: deptValue,
        estimatedDays,
      });
    }
    await logAudit({
      userId: actor.id,
      action: id ? AUDIT_ACTIONS.CATEGORY_UPDATE : AUDIT_ACTIONS.CATEGORY_CREATE,
      resource: 'categories',
      resourceId: id,
      ipAddress,
      userAgent,
      metadata: { name, slug, estimatedDays },
    });
  } catch {
    return { error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' };
  }

  revalidatePath('/admin/master-data');
  return { error: null, success: id ? 'แก้ไขหมวดหมู่เรียบร้อย' : 'เพิ่มหมวดหมู่เรียบร้อย' };
}

// ────────────────────────────────────────────────────────────────────────────
// เปิด/ปิดใช้งาน (แทนการลบ)
// ────────────────────────────────────────────────────────────────────────────

export async function toggleActive(formData: FormData): Promise<void> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(SUPERVISOR_ROLES);

  const v = validateFormData(toggleActiveFormSchema, formData);
  if (!v.success) return;
  const { id, kind } = v.data;

  const db = await getDb();
  const table = kind === 'department' ? departments : categories;

  const row = await firstOrUndefined(
    db.select({ isActive: table.isActive, name: table.name }).from(table).where(eq(table.id, id)).limit(1),
  );
  if (!row) return;

  const next = !row.isActive;
  await db.update(table).set({ isActive: next }).where(eq(table.id, id));

  await logAudit({
    userId: actor.id,
    action: next
      ? (kind === 'department' ? AUDIT_ACTIONS.DEPARTMENT_ACTIVATE : AUDIT_ACTIONS.CATEGORY_ACTIVATE)
      : (kind === 'department' ? AUDIT_ACTIONS.DEPARTMENT_DEACTIVATE : AUDIT_ACTIONS.CATEGORY_DEACTIVATE),
    resource: kind === 'department' ? 'departments' : 'categories',
    resourceId: id,
    ipAddress,
    userAgent,
    metadata: { name: row.name },
  });

  revalidatePath('/admin/master-data');
}
