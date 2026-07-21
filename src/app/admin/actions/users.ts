'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { users, userRoleEnum } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';
import { generateId } from '@/lib/id';
import { hashPassword } from '@/lib/password';
import { requireStaff } from '@/lib/auth/require-staff';

type UserRole = (typeof userRoleEnum.enumValues)[number];

/**
 * Server actions สำหรับจัดการ users (admin panel)
 *
 * สิทธิ์:
 *  - head/superadmin: สร้าง, ระงับ, เปลี่ยน role/department
 *  - superadmin: reset password
 *
 * ทุก action: requireStaff(supervisor) → validate → DB update → audit → revalidate
 */

const SUPERVISOR_ROLES: UserRole[] = ['head', 'superadmin'];
const SUPERADMIN_ONLY: UserRole[] = ['superadmin'];

export interface UserActionState {
  error: string | null;
  success?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. สร้าง user ใหม่
// ────────────────────────────────────────────────────────────────────────────

const VALID_ROLES = new Set<UserRole>(['officer', 'chief', 'head', 'superadmin']);

export async function createUser(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(SUPERVISOR_ROLES);

  const email = formData.get('email');
  const fullName = formData.get('fullName');
  const role = formData.get('role');
  const departmentId = formData.get('departmentId');
  const password = formData.get('password');

  if (
    typeof email !== 'string' ||
    typeof fullName !== 'string' ||
    typeof role !== 'string' ||
    typeof password !== 'string'
  ) {
    return { error: 'ข้อมูลไม่ครบถ้วน' };
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = fullName.trim();

  if (!trimmedEmail || !trimmedName || !password) {
    return { error: 'กรุณากรอกข้อมูลให้ครบ' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { error: 'รูปแบบอีเมลไม่ถูกต้อง' };
  }
  if (password.length < 8) {
    return { error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' };
  }
  if (!VALID_ROLES.has(role as UserRole)) {
    return { error: 'บทบาทไม่ถูกต้อง' };
  }

  const db = await getDb();

  // § เช็ค email ซ้ำ
  const existing = await firstOrUndefined(
    db.select({ id: users.id }).from(users).where(eq(users.email, trimmedEmail)).limit(1),
  );
  if (existing) {
    return { error: 'อีเมลนี้มีอยู่ในระบบแล้ว' };
  }

  const passwordHash = await hashPassword(password);
  const newUserId = generateId();
  const deptValue =
    typeof departmentId === 'string' && departmentId && departmentId !== '__none__'
      ? departmentId
      : null;

  try {
    await db.insert(users).values({
      id: newUserId,
      email: trimmedEmail,
      fullName: trimmedName,
      role: role as UserRole,
      departmentId: deptValue,
      passwordHash,
      isActive: true,
    });

    await logAudit({
      userId: actor.id,
      action: 'create_user',
      resource: 'users',
      resourceId: newUserId,
      ipAddress,
      userAgent,
      metadata: { email: trimmedEmail, fullName: trimmedName, role },
    });
  } catch (err) {
    console.error('[createUser] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' };
  }

  revalidatePath('/admin/users');
  redirect('/admin/users?ok=created');
}

// ────────────────────────────────────────────────────────────────────────────
// 2. สลับสถานะ active/suspended
// ────────────────────────────────────────────────────────────────────────────

export async function toggleUserActive(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(SUPERVISOR_ROLES);

  const userId = formData.get('userId');
  if (typeof userId !== 'string') {
    return { error: 'ข้อมูลไม่ครบถ้วน' };
  }

  // § ห้ามระงับตัวเอง
  if (userId === actor.id) {
    return { error: 'ไม่สามารถระงับบัญชีตัวเองได้' };
  }

  const db = await getDb();
  const target = await firstOrUndefined(
    db.select({ id: users.id, isActive: users.isActive, fullName: users.fullName, email: users.email, role: users.role }).from(users).where(eq(users.id, userId)).limit(1),
  );

  if (!target) {
    return { error: 'ไม่พบผู้ใช้' };
  }

  // § head ไม่ระงับ superadmin ได้ (superadmin เท่านั้นที่ระงับ superadmin ได้)
  if (target.role === 'superadmin' && actor.role !== 'superadmin') {
    return { error: 'ไม่สามารถระงับผู้ดูแลระบบได้ (ต้องการสิทธิ superadmin)' };
  }

  const newActive = !target.isActive;

  try {
    await db
      .update(users)
      .set({ isActive: newActive, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await logAudit({
      userId: actor.id,
      action: newActive ? 'activate_user' : 'deactivate_user',
      resource: 'users',
      resourceId: userId,
      ipAddress,
      userAgent,
      metadata: { fullName: target.fullName, email: target.email, previousState: target.isActive },
    });
  } catch (err) {
    console.error('[toggleUserActive] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการอัปเดต' };
  }

  revalidatePath('/admin/users');
  redirect('/admin/users?ok=toggled');
}

// ────────────────────────────────────────────────────────────────────────────
// 3. เปลี่ยน role/department
// ────────────────────────────────────────────────────────────────────────────

export async function updateUserRole(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(SUPERVISOR_ROLES);

  const userId = formData.get('userId');
  const role = formData.get('role');
  const departmentId = formData.get('departmentId');

  if (typeof userId !== 'string' || typeof role !== 'string') {
    return { error: 'ข้อมูลไม่ครบถ้วน' };
  }
  if (!VALID_ROLES.has(role as UserRole)) {
    return { error: 'บทบาทไม่ถูกต้อง' };
  }

  // § ห้ามเปลี่ยน role ตัวเอง (กัน self-escalation/de-escalation)
  if (userId === actor.id) {
    return { error: 'ไม่สามารถเปลี่ยนบทบาทตัวเองได้' };
  }

  const db = await getDb();
  const target = await firstOrUndefined(
    db.select({ id: users.id, role: users.role, fullName: users.fullName, email: users.email }).from(users).where(eq(users.id, userId)).limit(1),
  );

  if (!target) {
    return { error: 'ไม่พบผู้ใช้' };
  }

  // § head ไม่แตะ superadmin ได้
  if (target.role === 'superadmin' && actor.role !== 'superadmin') {
    return { error: 'ไม่สามารถแก้ไขผู้ดูแลระบบได้' };
  }

  const deptValue =
    typeof departmentId === 'string' && departmentId && departmentId !== '__none__'
      ? departmentId
      : null;

  try {
    await db
      .update(users)
      .set({ role: role as UserRole, departmentId: deptValue, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await logAudit({
      userId: actor.id,
      action: 'update_user_role',
      resource: 'users',
      resourceId: userId,
      ipAddress,
      userAgent,
      metadata: {
        fullName: target.fullName,
        email: target.email,
        previousRole: target.role,
        newRole: role,
        departmentId: deptValue,
      },
    });
  } catch (err) {
    console.error('[updateUserRole] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการอัปเดต' };
  }

  revalidatePath('/admin/users');
  redirect('/admin/users?ok=role');
}

// ────────────────────────────────────────────────────────────────────────────
// 4. รีเซ็ตรหัสผ่าน (superadmin เท่านั้น)
// ────────────────────────────────────────────────────────────────────────────

export async function resetPassword(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(SUPERADMIN_ONLY);

  const userId = formData.get('userId');
  const newPassword = formData.get('newPassword');

  if (typeof userId !== 'string' || typeof newPassword !== 'string') {
    return { error: 'ข้อมูลไม่ครบถ้วน' };
  }
  if (newPassword.length < 8) {
    return { error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' };
  }
  if (userId === actor.id) {
    return { error: 'ไม่สามารถรีเซ็ตรหัสผ่านตัวเองได้จากที่นี่' };
  }

  const db = await getDb();
  const target = await firstOrUndefined(
    db.select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role }).from(users).where(eq(users.id, userId)).limit(1),
  );

  if (!target) {
    return { error: 'ไม่พบผู้ใช้' };
  }

  try {
    const passwordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await logAudit({
      userId: actor.id,
      action: 'reset_user_password',
      resource: 'users',
      resourceId: userId,
      ipAddress,
      userAgent,
      metadata: { fullName: target.fullName, email: target.email },
    });
  } catch (err) {
    console.error('[resetPassword] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน' };
  }

  revalidatePath('/admin/users');
  redirect('/admin/users?ok=password');
}
