import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth, signOut } from '@/auth';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { users } from '@/lib/db/schema';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import type { UserRole } from '@/lib/auth/roles';

/**
 * ดึง IP address จาก request headers
 * (เรียบง่าย — ใช้ X-Forwarded-For หรือ X-Real-IP ตามลำดับ, fallback 'unknown')
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
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

  if (!staffUser || staffUser.role === 'citizen' || !staffUser.isActive) {
    const reason: StaffDenialReason = !staffUser
      ? 'no_staff_record'
      : staffUser.role === 'citizen'
        ? 'citizen_role'
        : 'inactive';
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

  // role whitelist check (optional)
  if (allowedRoles && !allowedRoles.includes(staffUser.role)) {
    await logAudit({
      action: AUDIT_ACTIONS.ACCESS_DENIED,
      resource: 'auth',
      userId: staffUser.id,
      ipAddress,
      userAgent,
      metadata: {
        reason: 'insufficient_role',
        role: staffUser.role,
        required: allowedRoles,
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
