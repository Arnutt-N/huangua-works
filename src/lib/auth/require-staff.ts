import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth, signOut } from '@/auth';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { users, type userRoleEnum } from '@/lib/db/schema';
import { logAudit } from '@/lib/audit';

type UserRole = (typeof userRoleEnum.enumValues)[number];

/**
 * ดึง IP address จาก request headers
 * (เรียบง่าย — ใช้ X-Forwarded-For หรือ X-Real-IP ตามลำดับ, fallback 'unknown')
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for') || h.get('x-real-ip') || 'unknown';
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
 * Extract จาก pattern ที่ duplicate ใน admin/page.tsx + admin/actions.ts (login)
 * — เพื่อให้ทุก admin route/action เช็คสิทธิ์เหมือนกันและลดความซ้ำซ้อน
 */
export async function requireStaff(allowedRoles?: readonly UserRole[]): Promise<StaffContext> {
  const session = await auth();
  if (!session?.user.userId) {
    redirect('/admin/login');
  }

  const db = await getDb();
  const staffUser = await firstOrUndefined(
    db.select().from(users).where(eq(users.id, session.user.userId)).limit(1)
  );

  const ipAddress = await getClientIp();
  const userAgent = await getClientUserAgent();

  if (!staffUser || staffUser.role === 'citizen' || !staffUser.isActive) {
    // § session ยัง valid แต่ role/isActive ไม่ผ่าน — เกิดขึ้นได้เมื่อบัญชีถูกระงับหลัง login
    // § ต้อง signOut ก่อน redirect ไม่งั้น cookie ยังอยู่ → proxy bounce กลับ → วนลูป (H1)
    await signOut({ redirect: false });
    await logAudit({
      action: 'access_denied',
      resource: 'auth',
      userId: staffUser?.id,
      ipAddress,
      userAgent,
      metadata: {
        reason: !staffUser
          ? 'no_staff_record'
          : staffUser.role === 'citizen'
            ? 'citizen_role'
            : 'inactive',
      },
    });
    redirect('/admin/login');
  }

  // role whitelist check (optional)
  if (allowedRoles && !allowedRoles.includes(staffUser.role)) {
    await logAudit({
      action: 'access_denied',
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
    redirect('/admin'); // ไม่ใช่ login — ส่งกลับ dashboard เพราะ login ผ่านแล้ว
  }

  return { user: staffUser, ipAddress, userAgent };
}
