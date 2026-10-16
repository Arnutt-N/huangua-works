'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { auth, signIn, signOut } from '@/auth';
import { CredentialsSignin } from 'next-auth';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { users } from '@/lib/db/schema';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { formatReset } from '@/lib/rate-limit/format-reset';
import { getClientIp } from '@/lib/auth/require-staff';
import { headers } from 'next/headers';
import { IneligibleAccountSignin } from '@/lib/auth/login-errors';
import { loginDenialReason, type LoginDenialReason } from '@/lib/auth/roles';

export interface LoginState {
  error: string | null;
  success?: boolean;
}

type IneligibleReason = LoginDenialReason | 'no_staff_record';

const INELIGIBLE_MESSAGES: Record<IneligibleReason, string> = {
  inactive: 'บัญชีนี้ถูกระงับการใช้งาน',
  citizen_role: 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานส่วนเจ้าหน้าที่',
  no_staff_record: 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานส่วนเจ้าหน้าที่',
};

// § ใช้ access_denied (ไม่ใช่ login_failure) เพราะตัวตนยืนยันผ่านแล้ว — ปฏิเสธการเข้าถึง
// (login_failure เก็บไว้สำหรับ credential ไม่ถูก เพื่อให้ SIEM คำนวณ brute-force rate แยกจาก suspended-login)
async function denyLogin(
  reason: IneligibleReason,
  userId: string | undefined,
  email: string,
  ip: string,
): Promise<LoginState> {
  await logAudit({
    action: AUDIT_ACTIONS.ACCESS_DENIED,
    resource: 'auth',
    userId,
    ipAddress: ip,
    metadata: { email, reason },
  });
  return { error: INELIGIBLE_MESSAGES[reason] };
}

/**
 * เจ้าหน้าที่ login — email+password ผ่าน Auth.js v5 (Credentials provider)
 * authorize() ปฏิเสธ citizen/บัญชีระงับหลังยืนยันรหัส (throw IneligibleAccountSignin) — action
 * แปลงเป็นข้อความเจาะจง + ACCESS_DENIED (ไม่ใช่ enumeration risk: รหัสถูกแล้ว)
 * post-check หลัง signIn เหลือไว้กัน race (ถูกระงับ/ลบระหว่าง authorize กับตรงนี้)
 */
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const emailRaw = formData.get('email');
  const passwordRaw = formData.get('password');
  // § "จดจำฉัน" — checkbox ส่ง 'on' เมื่อติ๊ก; null/undefined เมื่อไม่ติ๊ก
  // ส่งต่อให้ authorize → jwt callback กำหนดอายุ session (1h vs 30d)
  const rememberRaw = formData.get('remember');

  if (typeof emailRaw !== 'string' || typeof passwordRaw !== 'string' || !emailRaw || !passwordRaw) {
    return { error: 'กรุณากรอกอีเมลและรหัสผ่าน' };
  }

  const ip = await getClientIp();
  const normalizedEmail = emailRaw.trim().toLowerCase();

  // § จำกัดทั้งต่อ IP และต่อ email แยกกัน — IP อย่างเดียวปลอมผ่าน X-Forwarded-For ได้
  // ง่าย (ไม่มี trusted reverse proxy คั่นใน local/self-host) แต่ per-email ยังจำกัดได้จริง
  // เพราะผูกกับบัญชีเป้าหมาย ไม่ใช่ header ที่ client กำหนดเอง
  const [ipRateLimit, emailRateLimit] = await Promise.all([
    enforceRateLimit('adminLoginIp', ip),
    enforceRateLimit('adminLoginEmail', normalizedEmail),
  ]);
  if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
    const reset = Math.max(ipRateLimit.reset, emailRateLimit.reset);
    return { error: `เข้าสู่ระบบถี่เกินไป กรุณารอ ${formatReset(reset)}` };
  }

  // § Auth.js ไม่ throw CredentialsSignin เมื่อ request มี X-Auth-Return-Redirect (signIn copy header
  // ขาเข้าทั้งชุด) — รหัสผิดจะกลายเป็น "สำเร็จ" + oracle อีเมลจาก post-check; server action
  // ไม่มีผู้ใช้ header นี้โดยชอบ จึงปฏิเสธทันที (นับเป็น login_failure ให้ SIEM เห็นการ probe)
  if ((await headers()).has('x-auth-return-redirect')) {
    await logAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILURE,
      resource: 'auth',
      ipAddress: ip,
      metadata: { email: normalizedEmail, reason: 'auth_return_redirect_header' },
    });
    return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
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
      // § ส่ง remember ('on' เมื่อติ๊ก) ให้ authorize → jwt callback ตั้งอายุ session
      ...(rememberRaw ? { remember: String(rememberRaw) } : {}),
      redirect: false,
    });
    signInOk = true;
  } catch (err) {
    // § CredentialsSignin = authorize คืน null = รหัสผ่าน/email ไม่ถูก (user-facing error)
    // error อื่น (ProviderAuthError, Configuration) = runtime/config issue → re-throw ให้ Next
    // แปลงเป็น 500 (ถ้า catch หมดทุกกรณีจะกลบ config error ทำให้ troubleshooting ผิดทาง)
    // § instanceof เท่านั้น — ห้ามเทียบ err.name: @auth/core ตั้ง name จาก constructor.name
    // ซึ่งโดน minify เปลี่ยนชื่อใน prod build → name ไม่ตรง → re-throw → wrong-password
    // กลายเป็น 500 ทั้งหน้า (dev ไม่ minify จึงไม่เกิด — เจอใน prod อย่างเดียว)
    // § IneligibleAccountSignin เป็น subclass ของ CredentialsSignin — ต้องเช็คก่อน ไม่งั้นตกไป
    // branch "รหัสผิด" (รหัสถูกแต่บัญชีระงับ/citizen → ข้อความเจาะจง + ACCESS_DENIED, ไม่มี session)
    if (err instanceof IneligibleAccountSignin) {
      return denyLogin(err.reason, err.userId, normalizedEmail, ip);
    }
    if (!(err instanceof CredentialsSignin)) throw err;
    await logAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILURE,
      resource: 'auth',
      ipAddress: ip,
      metadata: { email: normalizedEmail, reason: 'invalid_credentials' },
    });
    return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  }

  if (!signInOk) return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };

  // รหัสผ่านถูกและ authorize ผ่าน eligibility แล้ว — อ่านสดอีกรอบกัน race + เอา userId ไป audit
  const db = await getDb();
  const staffUser = await firstOrUndefined(
    db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
  );

  const denial: IneligibleReason | null = !staffUser
    ? 'no_staff_record'
    : loginDenialReason(staffUser.role, staffUser.isActive);
  if (!staffUser || denial) {
    // § กัน race: ถูกระงับ/ลบระหว่าง authorize กับตรงนี้ — signIn ตั้ง cookie ไปแล้ว ต้อง signOut
    // ทันที ไม่งั้น session valid แต่หน้า admin เตะออกอยู่ดี (defense-in-depth) เสียประสบการณ์
    await signOut({ redirect: false });
    return denyLogin(denial ?? 'no_staff_record', staffUser?.id, normalizedEmail, ip);
  }

  await logAudit({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    resource: 'auth',
    userId: staffUser.id,
    ipAddress: ip,
  });

  // § ไม่ redirect() ในนี้ — signIn() ตั้ง cookie ผ่าน response เดียวกัน แต่ redirect()
  // ที่ throw NEXT_REDIRECT ในหน้าเดิมทำให้บาง build ของ Auth.js v5 beta + Next.js 16
  // ไม่ commit Set-Cookie ให้ browser ทัน (login สำเร็จจริงแต่ cookie ไม่เคยถูกตั้ง — H1 bug)
  // แก้โดยคืนค่าสำเร็จแทน แล้วให้ client navigate เอง หลัง response (พร้อม cookie) ถึง browser แล้ว
  return { error: null, success: true };
}

export async function logout(): Promise<void> {
  // § อ่าน session ปัจจุบันเพื่อ audit (ว่าใครออกจากระบบ) ก่อน signOut ล้าง cookie
  const session = await auth();

  await signOut({ redirect: false });

  await logAudit({
    action: AUDIT_ACTIONS.LOGOUT,
    resource: 'auth',
    userId: session?.user.userId,
    metadata: session?.user ? { email: session.user.email } : undefined,
  });

  redirect('/admin/login');
}
