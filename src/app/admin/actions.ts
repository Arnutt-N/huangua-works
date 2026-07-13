'use server';

import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { logAudit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { users } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/upstash';

export interface LoginState {
  error: string | null;
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for') || h.get('x-real-ip') || 'unknown';
}

/**
 * เจ้าหน้าที่ login — email+password ผ่าน Supabase Auth
 * ตรวจ role/isActive ที่นี่ (ไม่ใช่แค่ page-level) เพื่อให้ error message เจาะจงได้
 * (เช่น "บัญชีถูกระงับ") เพราะ ณ จุดนี้ยืนยันรหัสผ่านถูกแล้ว ไม่ใช่ enumeration risk
 */
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const emailRaw = formData.get('email');
  const passwordRaw = formData.get('password');

  if (typeof emailRaw !== 'string' || typeof passwordRaw !== 'string' || !emailRaw || !passwordRaw) {
    return { error: 'กรุณากรอกอีเมลและรหัสผ่าน' };
  }

  const ip = await getClientIp();
  const normalizedEmail = emailRaw.trim().toLowerCase();

  // § จำกัดทั้งต่อ IP และต่อ email แยกกัน — IP อย่างเดียวปลอมผ่าน X-Forwarded-For ได้
  // ง่าย (ไม่มี trusted reverse proxy คั่นใน local/self-host) แต่ per-email ยังจำกัดได้จริง
  // เพราะผูกกับบัญชีเป้าหมาย ไม่ใช่ header ที่ client กำหนดเอง
  const [ipRateLimit, emailRateLimit] = await Promise.all([
    checkRateLimit(`rate:admin-login:ip:${ip}`, 5, 900),
    checkRateLimit(`rate:admin-login:email:${normalizedEmail}`, 5, 900),
  ]);
  if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
    const reset = Math.max(ipRateLimit.reset, emailRateLimit.reset);
    return { error: `เข้าสู่ระบบถี่เกินไป กรุณารอ ${reset} วินาที` };
  }

  // § ยืนยันรหัสผ่านกับ Supabase Auth ก่อน — ไม่เช็ค users table ก่อน signIn
  // (เลี่ยง enumeration oracle เดา email ได้จาก error message ที่ต่างกัน)
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: passwordRaw,
  });

  if (authError || !data.user) {
    await logAudit({
      action: 'login_failure',
      resource: 'auth',
      ipAddress: ip,
      metadata: { email: normalizedEmail, reason: 'invalid_credentials' },
    });
    return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  }

  const db = await getDb();
  const staffUser = await firstOrUndefined(
    db.select().from(users).where(eq(users.authUserId, data.user.id)).limit(1)
  );

  if (!staffUser || staffUser.role === 'citizen' || !staffUser.isActive) {
    await supabase.auth.signOut();
    await logAudit({
      action: 'login_failure',
      resource: 'auth',
      userId: staffUser?.id,
      ipAddress: ip,
      metadata: {
        email: normalizedEmail,
        reason: !staffUser ? 'no_staff_record' : staffUser.role === 'citizen' ? 'citizen_role' : 'inactive',
      },
    });
    return {
      error: staffUser && !staffUser.isActive
        ? 'บัญชีนี้ถูกระงับการใช้งาน'
        : 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานส่วนเจ้าหน้าที่',
    };
  }

  await logAudit({
    action: 'login_success',
    resource: 'auth',
    userId: staffUser.id,
    ipAddress: ip,
  });

  redirect('/admin');
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  await logAudit({
    action: 'logout',
    resource: 'auth',
    metadata: user ? { authUserId: user.id } : undefined,
  });

  redirect('/admin/login');
}
