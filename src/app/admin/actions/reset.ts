'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { users } from '@/lib/db/schema';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { hashPassword } from '@/lib/password';
import { getClientIp, getClientUserAgent } from '@/lib/auth/require-staff';
import { checkRateLimit } from '@/lib/upstash';
import {
  createResetToken,
  validateResetToken,
  consumeResetToken,
} from '@/lib/auth/reset-token';
import { sendMail, buildResetEmailHtml } from '@/lib/mail';
import {
  forgotPasswordRequestSchema,
  forgotPasswordResetSchema,
  validateFormData,
} from '@/lib/validation';

/**
 * Server actions — รีเซ็ตรหัสผ่านด้วยตนเอง (self-service)
 *
 * ต่างจาก actions/users.ts (admin ตั้งรหัสตรง) ตรงนี้เป็น "public" action:
 * ผู้ใช้ยังไม่ได้ login จึงไม่เรียก requireStaff() — ความปลอดภัยอยู่ที่
 *   1. rate limit (fail-secure) กัน brute-force/email bombing
 *   2. anti-enumeration — คืน message เดียวกันไม่ว่า email จะมีในระบบหรือไม่
 *   3. token เดียวใช้ครั้งเดียว + หมดอายุ 1h + เก็บเป็น SHA-256 hash
 *   4. re-check isActive/role อีกครั้งตอนใช้ token (กันบัญชีถูกระงับหลังขอลิงก์)
 */

export interface ResetRequestState {
  error: string | null;
  success?: boolean;
}

export interface ResetCompleteState {
  error: string | null;
  success?: boolean;
}

const GENERIC_REQUEST_MSG =
  'หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว';

function getBaseUrl(): string {
  return process.env.AUTH_URL || 'http://localhost:3000';
}

// ────────────────────────────────────────────────────────────────────────────
// 1. ขอรีเซ็ตรหัสผ่าน (กรอกอีเมล)
// ────────────────────────────────────────────────────────────────────────────

export async function requestPasswordReset(
  _prevState: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const v = validateFormData(forgotPasswordRequestSchema, formData);
  // § validation fail คืน error จริงได้ (ไม่ใช่ enumeration — บอกแค่ format ผิด)
  if (!v.success) return { error: v.error };
  const email = v.data.email; // emailSchema transform เป็น lowercase+trim แล้ว

  const ip = await getClientIp();
  const userAgent = await getClientUserAgent();

  // § จำกัดทั้งต่อ IP และต่อ email — กัน email bombing (ส่งลิงก์รัวๆ ก่อกวนผู้ใช้)
  // และกัน brute-force ลอง email; fail-secure เหมือน login path
  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit(`rate:pw-reset:ip:${ip}`, 5, 900, { failOpen: false }),
    checkRateLimit(`rate:pw-reset:email:${email}`, 3, 900, { failOpen: false }),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const reset = Math.max(ipLimit.reset, emailLimit.reset);
    return { error: `ส่งคำขอถี่เกินไป กรุณารอ ${reset} วินาที` };
  }

  const db = await getDb();
  const user = await firstOrUndefined(
    db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1),
  );

  // § anti-enumeration — เฉพาะ staff ที่ active เท่านั้นที่ส่งลิงก์จริง แต่คืน
  // message เดียวกันทุกกรณี กัน attacker ลองเช็คว่า email ไหนมีในระบบ
  const eligible = !!user && user.role !== 'citizen' && user.isActive;

  if (eligible && user) {
    try {
      const plaintext = await createResetToken(user.id);
      const resetUrl = `${getBaseUrl()}/admin/reset-password?token=${plaintext}`;
      await sendMail(
        user.email,
        'รีเซ็ตรหัสผ่าน — อบต.หัวงัว',
        buildResetEmailHtml(user.fullName, resetUrl),
      );
      await logAudit({
        action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
        resource: 'auth',
        userId: user.id,
        ipAddress: ip,
        userAgent,
      });
    } catch (err) {
      // § ส่งอีเมล/DB ล้มเหลว — ไม่บอกผู้ใช้ (กัน enumeration) แต่ log ให้ operator
      console.error('[requestPasswordReset] failed to issue/send reset', err);
      await logAudit({
        action: AUDIT_ACTIONS.PASSWORD_RESET_FAILURE,
        resource: 'auth',
        userId: user.id,
        ipAddress: ip,
        userAgent,
        metadata: { reason: 'send_error' },
      });
    }
  } else {
    // ไม่เข้าเงื่อนไข (ไม่มี user / citizen / inactive) — ไม่ส่งลิงก์ แต่คืนค่าเดียวกัน
    await logAudit({
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      resource: 'auth',
      ipAddress: ip,
      userAgent,
      metadata: { email, eligible: false },
    });
  }

  return { error: null, success: true };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. ยืนยันรีเซ็ตรหัสผ่าน (จากลิงก์ในอีเมล)
// ────────────────────────────────────────────────────────────────────────────

export async function completePasswordReset(
  _prevState: ResetCompleteState,
  formData: FormData,
): Promise<ResetCompleteState> {
  const v = validateFormData(forgotPasswordResetSchema, formData);
  if (!v.success) return { error: v.error };
  const { token, newPassword } = v.data;

  const ip = await getClientIp();
  const userAgent = await getClientUserAgent();

  // § จำกัดการลอง token — แม้ token 256-bit จะเดาไม่ได้ แต่กันการยิง request รัวๆ
  const limit = await checkRateLimit(`rate:pw-reset:complete:${ip}`, 5, 900, {
    failOpen: false,
  });
  if (!limit.allowed) {
    return { error: `ส่งคำขอถี่เกินไป กรุณารอ ${limit.reset} วินาที` };
  }

  const tokenRow = await validateResetToken(token);
  if (!tokenRow) {
    await logAudit({
      action: AUDIT_ACTIONS.PASSWORD_RESET_FAILURE,
      resource: 'auth',
      ipAddress: ip,
      userAgent,
      metadata: { reason: 'invalid_or_expired_token' },
    });
    return { error: 'ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่' };
  }

  const db = await getDb();
  // § re-check ผู้ใช้ตอนใช้ token — ถ้าบัญชีถูกระงับ/เปลี่ยน role หลังขอลิงก์ ให้ปฏิเสธ
  const user = await firstOrUndefined(
    db
      .select({ id: users.id, role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, tokenRow.userId))
      .limit(1),
  );

  if (!user || user.role === 'citizen' || !user.isActive) {
    await logAudit({
      action: AUDIT_ACTIONS.PASSWORD_RESET_FAILURE,
      resource: 'auth',
      userId: tokenRow.userId,
      ipAddress: ip,
      userAgent,
      metadata: { reason: 'user_ineligible' },
    });
    return { error: 'ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่' };
  }

  try {
    const passwordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // § เผา token ทิ้งหลังอัปเดตรหัสผ่านสำเร็จ (single-use)
    await consumeResetToken(tokenRow.id);

    await logAudit({
      action: AUDIT_ACTIONS.PASSWORD_RESET_SUCCESS,
      resource: 'auth',
      userId: user.id,
      ipAddress: ip,
      userAgent,
    });
  } catch (err) {
    console.error('[completePasswordReset] failed', err);
    return { error: 'ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่' };
  }

  return { error: null, success: true };
}
