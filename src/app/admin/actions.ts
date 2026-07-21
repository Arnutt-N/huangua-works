'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { logAudit } from '@/lib/audit';
import { auth, signIn, signOut } from '@/auth';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { users } from '@/lib/db/schema';
import { checkRateLimit } from '@/lib/upstash';
import { getClientIp } from '@/lib/auth/require-staff';

export interface LoginState {
  error: string | null;
}

/**
 * เจ้าหน้าที่ login — email+password ผ่าน Auth.js v5 (Credentials provider)
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
    checkRateLimit(`rate:admin-login:ip:${ip}`, 5, 900, { failOpen: false }),
    checkRateLimit(`rate:admin-login:email:${normalizedEmail}`, 5, 900, {
      failOpen: false,
    }),
  ]);
  if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
    const reset = Math.max(ipRateLimit.reset, emailRateLimit.reset);
    return { error: `เข้าสู่ระบบถี่เกินไป กรุณารอ ${reset} วินาที` };
  }

  // § ยืนยันรหัสผ่านก่อน (ผ่าน Auth.js Credentials authorize callback → bcrypt.compare)
  // Auth.js v5: signIn คืน URL string เสมอเมื่อ redirect:false และสำเร็จ;
  // ถ้า authorize คืน null (รหัสผ่านไม่ถูก/ไม่มี user) signIn จะ throw CredentialsSignin error
  // (ไม่ใช่คืน { error } เหมือน v4) — ต้อง try/catch เพื่อแปลงเป็น Thai message
  // เหมือนเดิม: ไม่ lookup users table ก่อน verify รหัสผ่าน เพื่อกัน enumeration oracle
  // § แยก CredentialsSignin (รหัสไม่ถูก) จาก Configuration/ProviderAuthError (misconfig)
  // ไม่งั้น AUTH_SECRET ผิด → ผู้ใช้เห็น "รหัสผ่านไม่ถูก" ทั้งที่จริงๆ ควรเป็น 500
  let signInOk = false;
  try {
    await signIn('credentials', {
      email: normalizedEmail,
      password: passwordRaw,
      redirect: false,
    });
    signInOk = true;
  } catch (err) {
    // § CredentialsSignin = authorize คืน null = รหัสผ่าน/email ไม่ถูก (user-facing error)
    // error อื่น (ProviderAuthError, Configuration) = runtime/config issue → re-throw ให้ Next
    // แปลงเป็น 500 (ถ้า catch หมดทุกกรณีจะกลบ config error ทำให้ troubleshooting ผิดทาง)
    const isCredentialsError =
      err instanceof Error && err.name === 'CredentialsSignin';
    if (!isCredentialsError) throw err;
    await logAudit({
      action: 'login_failure',
      resource: 'auth',
      ipAddress: ip,
      metadata: { email: normalizedEmail, reason: 'invalid_credentials' },
    });
    return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  }

  if (!signInOk) return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };

  // รหัสผ่านถูกแล้ว — อ่าน role/isActive จาก DB เพื่อตรวจเจาะจง
  // (authorize callback ตั้งใจไม่เช็ค 2 อย่างนี้ — เก็บ error message ที่เจาะจงเอาไว้ที่นี่แทน)
  const db = await getDb();
  const staffUser = await firstOrUndefined(
    db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
  );

  if (!staffUser || staffUser.role === 'citizen' || !staffUser.isActive) {
    // § รหัสผ่านถูกแต่บัญชีไม่มีสิทธิ์ — ต้อง signOut ทันทีเพื่อล้าง cookie ที่ signIn สร้างไว้
    // ไม่งั้น session valid แต่หน้า admin เตะออกอยู่ดี (defense-in-depth) เสียประสบการณ์
    await signOut({ redirect: false });
    // § ใช้ access_denied (ไม่ใช่ login_failure) เพราะตัวตนยืนยันผ่านแล้ว — ปฏิเสธการเข้าถึง
    // (login_failure เก็บไว้สำหรับ credential ไม่ถูก เพื่อให้ SIEM คำนวณ brute-force rate แยกจาก suspended-login)
    await logAudit({
      action: 'access_denied',
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
  // § อ่าน session ปัจจุบันเพื่อ audit (ว่าใครออกจากระบบ) ก่อน signOut ล้าง cookie
  const session = await auth();

  await signOut({ redirect: false });

  await logAudit({
    action: 'logout',
    resource: 'auth',
    userId: session?.user.userId,
    metadata: session?.user ? { email: session.user.email } : undefined,
  });

  redirect('/admin/login');
}
