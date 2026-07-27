'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { users } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';
import { hashPassword, verifyPassword } from '@/lib/password';
import { requireStaff } from '@/lib/auth/require-staff';
import { checkRateLimit } from '@/lib/upstash';
import {
  changeOwnPasswordFormSchema,
  updateProfileFormSchema,
  validateFormData,
} from '@/lib/validation';

/**
 * Server actions สำหรับ "บัญชีของฉัน" (/admin/settings)
 *
 * ต่างจาก actions/users.ts ตรงที่ไม่ต้องมีสิทธิ์ supervisor — เจ้าหน้าที่ทุกคนแก้ของ
 * ตัวเองได้ แต่ "ตัวเอง" ต้องมาจาก session เท่านั้น ห้ามรับ userId จากฟอร์ม
 * ไม่งั้นจะกลายเป็นช่องให้แก้บัญชีคนอื่น
 */

export interface ProfileActionState {
  error: string | null;
  success?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. แก้ข้อมูลส่วนตัว
// ────────────────────────────────────────────────────────────────────────────

export async function updateProfile(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff();

  const v = validateFormData(updateProfileFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { fullName, phoneNumber } = v.data;

  const db = await getDb();
  try {
    await db
      .update(users)
      .set({
        fullName,
        phoneNumber: phoneNumber ? phoneNumber : null,
        updatedAt: new Date(),
      })
      // § ผูกกับ session ไม่ใช่ค่าจากฟอร์ม
      .where(eq(users.id, actor.id));

    await logAudit({
      userId: actor.id,
      action: 'profile_update',
      resource: 'users',
      resourceId: actor.id,
      ipAddress,
      userAgent,
      // ไม่บันทึกค่าเบอร์โทรลง audit (PII) — บันทึกแค่ว่ามีการเปลี่ยนหรือไม่
      metadata: { fields: ['fullName', 'phoneNumber'] },
    });
  } catch {
    return { error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' };
  }

  revalidatePath('/admin/settings');
  return { error: null, success: 'บันทึกข้อมูลส่วนตัวเรียบร้อย' };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. เปลี่ยนรหัสผ่านของตัวเอง
// ────────────────────────────────────────────────────────────────────────────

export async function changeOwnPassword(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff();

  const v = validateFormData(changeOwnPasswordFormSchema, formData);
  if (!v.success) return { error: v.error };
  const { currentPassword, newPassword } = v.data;

  // § จำกัดจำนวนครั้ง — ฟอร์มนี้ยืนยันรหัสผ่านเดิม จึงเป็น oracle ให้เดารหัสได้
  // ถ้าใครขโมย session ไปแล้ว ใช้ failOpen:false เหมือน path login ด้วยเหตุผลเดียวกัน
  const limit = await checkRateLimit(`rate:change-password:${actor.id}`, 5, 900, {
    failOpen: false,
  });
  if (!limit.allowed) {
    return { error: `เปลี่ยนรหัสผ่านถี่เกินไป กรุณารอ ${limit.reset} วินาที` };
  }

  const db = await getDb();
  const row = await firstOrUndefined(
    db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, actor.id))
      .limit(1),
  );

  if (!row?.passwordHash) {
    return { error: 'บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ' };
  }

  const ok = await verifyPassword(currentPassword, row.passwordHash);
  if (!ok) {
    await logAudit({
      userId: actor.id,
      action: 'password_change_failure',
      resource: 'auth',
      resourceId: actor.id,
      ipAddress,
      userAgent,
      metadata: { reason: 'invalid_current_password' },
    });
    return { error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' };
  }

  try {
    const passwordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, actor.id));

    await logAudit({
      userId: actor.id,
      action: 'password_change',
      resource: 'auth',
      resourceId: actor.id,
      ipAddress,
      userAgent,
    });
  } catch {
    return { error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่' };
  }

  return {
    error: null,
    success: 'เปลี่ยนรหัสผ่านเรียบร้อย — ครั้งต่อไปให้เข้าระบบด้วยรหัสผ่านใหม่',
  };
}
