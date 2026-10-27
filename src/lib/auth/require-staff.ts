import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth, signOut } from '@/auth';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { users } from '@/lib/db/schema';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { CASE_SUPERVISOR_ROLES, loginDenialReason, SUPERADMIN_ONLY, type UserRole } from '@/lib/auth/roles';

/**
 * UI gate ฝั่ง supervisor action — ใช้ tier matrix เดียวกับ server (`resolveAllowedRoles`)
 * async เสมอ (อ่าน DB) และ fail-closed ตามเดิม (อ่านไม่ได้ → superadmin เท่านั้น)
 */
export async function canUseSupervisorAction(role: UserRole): Promise<boolean> {
  const allowed = await resolveAllowedRoles(CASE_SUPERVISOR_ROLES);
  return allowed?.includes(role) ?? false;
}
import { getTierRoles, tierKeyForRoles } from '@/lib/auth/tiers';

/**
 * § จุดคอขวดเดียวที่ map whitelist → tier key (เทียบด้วยค่า ไม่ใช่ reference —
 * spread/สำเนา/literal เทียบเท่าเข้า matrix เหมือน const เดิม interrogate D-14)
 * call site ไม่ต้องเปลี่ยน — DB มี override ใช้ของ DB ไม่มีใช้ค่าคงที่เดิม
 * array แปลกหน้า (ไม่ใช่ 4 tier มาตรฐาน) ผ่านตรงเหมือนเดิม
 */
export async function resolveAllowedRoles(
  allowedRoles?: readonly UserRole[],
): Promise<readonly UserRole[] | undefined> {
  if (!allowedRoles) return undefined;
  const key = tierKeyForRoles(allowedRoles);
  if (!key) return allowedRoles;
  try {
    return await getTierRoles(key);
  } catch (err) {
    // § fail-closed จริง: อ่าน matrix ไม่ได้ = ไม่รู้ว่าแอดมินตั้ง override แคบแค่ไหน — whitelist ของ
    // caller คือ compiled default ของ tier (tierKeyForRoles เทียบค่า) ซึ่งกว้างกว่า override ได้
    // เหลือ superadmin ที่อยู่ทุก tier เสมอ (#111) ระบบจึงไม่ล็อกทั้งหมด
    console.error(`[auth] tier matrix unreadable (${key}), fail-closed to superadmin only`, err);
    return SUPERADMIN_ONLY;
  }
}
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';

/**
 * ดึง IP address จาก request headers ของ server action / server component
 * (สูตรจริงอยู่ที่ clientIpFromHeaders — route handler เรียกตัวนั้นกับ req.headers ตรง ๆ)
 */
export async function getClientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

export async function getClientUserAgent(): Promise<string | undefined> {
  const h = await headers();
  return h.get('user-agent') || undefined;
}

export interface StaffContext {
  user: typeof users.$inferSelect;
  ipAddress: string;
  userAgent: string | undefined;
}

type StaffDenialReason =
  | 'no_session'
  | 'no_staff_record'
  | 'citizen_role'
  | 'inactive'
  | 'stale_credentials'
  | 'insufficient_role';

type StaffResolution =
  | { ok: true; ctx: StaffContext }
  | { ok: false; reason: StaffDenialReason };

/**
 * การตัดสินสิทธิ์จริง — ไม่ redirect ไม่ signOut ไม่ตอบ HTTP
 *
 * เจ้าของ audit log ของทุก denial (ยกเว้น no_session ที่ไม่มี user ให้บันทึก)
 * เพื่อให้ทั้ง requireStaff (redirect) และ requireStaffApi (JSON) ตัดสินเหมือนกัน
 */
async function resolveStaff(allowedRoles?: readonly UserRole[]): Promise<StaffResolution> {
  const session = await auth();
  if (!session?.user.userId) {
    return { ok: false, reason: 'no_session' };
  }

  const db = await getDb();
  const staffUser = await firstOrUndefined(
    db.select().from(users).where(eq(users.id, session.user.userId)).limit(1)
  );

  const ipAddress = await getClientIp();
  const userAgent = await getClientUserAgent();

  const denial: StaffDenialReason | null = !staffUser
    ? 'no_staff_record'
    : loginDenialReason(staffUser.role, staffUser.isActive);
  if (!staffUser || denial) {
    const reason: StaffDenialReason = denial ?? 'no_staff_record';
    await logAudit({
      action: AUDIT_ACTIONS.ACCESS_DENIED,
      resource: 'auth',
      userId: staffUser?.id,
      ipAddress,
      userAgent,
      metadata: { reason },
    });
    return { ok: false, reason };
  }

  // § ตัด session ค้างหลังเปลี่ยนรหัส (#108) — เช็คก่อน tier เสมอ: session เน่า
  // ไม่มีสิทธิ์อะไรทั้งนั้น ไม่ต้องเสียค่า resolve matrix
  const sessionVersion = session.user.passwordVersion ?? 1;
  if (sessionVersion !== staffUser.passwordVersion) {
    await logAudit({
      action: AUDIT_ACTIONS.ACCESS_DENIED,
      resource: 'auth',
      userId: staffUser.id,
      ipAddress,
      userAgent,
      metadata: { reason: 'stale_credentials' },
    });
    return { ok: false, reason: 'stale_credentials' };
  }

  // role whitelist check (optional) — ผ่าน tier matrix ก่อนเสมอ
  const effectiveRoles = await resolveAllowedRoles(allowedRoles);
  if (effectiveRoles && !effectiveRoles.includes(staffUser.role)) {
    await logAudit({
      action: AUDIT_ACTIONS.ACCESS_DENIED,
      resource: 'auth',
      userId: staffUser.id,
      ipAddress,
      userAgent,
      metadata: {
        reason: 'insufficient_role',
        role: staffUser.role,
        required: effectiveRoles,
      },
    });
    return { ok: false, reason: 'insufficient_role' };
  }

  return { ok: true, ctx: { user: staffUser, ipAddress, userAgent } };
}

/**
 * ตรวจสอบว่า request ปัจจุบันมาจากเจ้าหน้าที่ที่ login แล้วและมีสิทธิ์
 *
 * - อ่าน session จาก JWT cookie (auth())
 * - re-fetch user row จาก DB เพื่อตรวจ role/isActive แบบสด (defense-in-depth)
 *   (JWT เป็น snapshot ตอน login — role/isActive เปลี่ยนกลางคันจะไม่เห็นใน JWT)
 * - ถ้าไม่ผ่าน: signOut + audit + redirect '/admin/login'
 * - ถ้าผ่าน: คืน StaffContext (user + ipAddress + userAgent)
 *
 * @param allowedRoles optional whitelist — ถ้าระบุ จะเช็คเพิ่มว่า role อยู่ใน list
 *   (เช่น `requireStaff(['superadmin'])` สำหรับการจัดการ user)
 *
 * สำหรับ API route handler ใช้ requireStaffApi() แทน — redirect() ที่นี่จะกลายเป็น
 * 307 ไปหน้า HTML login ซึ่ง fetch caller อ่านไม่ได้
 */
export async function requireStaff(allowedRoles?: readonly UserRole[]): Promise<StaffContext> {
  const result = await resolveStaff(allowedRoles);
  if (result.ok) return result.ctx;

  if (result.reason === 'insufficient_role') {
    redirect('/admin'); // ไม่ใช่ login — ส่งกลับ dashboard เพราะ login ผ่านแล้ว
  }

  // § session หมดอายุ/ถูกระงับ แต่ cookie 30d อาจยังค้างอยู่ — ต้อง signOut ล้าง cookie
  // ก่อน redirect กัน unauthorized เห็น cookie แล้ว bounce กลับ (H1)
  await signOut({ redirect: false });
  redirect('/admin/login');
}

/**
 * requireStaff เวอร์ชันสำหรับ API route handler — ตอบ JSON แทน redirect
 *
 * ใช้คู่กับ early return:
 * ```ts
 * const authz = await requireStaffApi(STAFF_ROLES);
 * if (!authz.ok) return authz.response;
 * ```
 *
 * ไม่ signOut โดยเจตนา — API call ที่หลุดมาไม่ควรล้าง session ของ browser
 */
export async function requireStaffApi(
  allowedRoles?: readonly UserRole[]
): Promise<{ ok: true; ctx: StaffContext } | { ok: false; response: NextResponse }> {
  const result = await resolveStaff(allowedRoles);
  if (result.ok) return result;

  const forbidden = result.reason === 'insufficient_role';
  return {
    ok: false,
    response: NextResponse.json(
      { error: forbidden ? 'Forbidden' : 'Unauthorized' },
      { status: forbidden ? 403 : 401 }
    ),
  };
}
