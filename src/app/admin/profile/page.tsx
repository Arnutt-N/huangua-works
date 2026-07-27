import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { departments, users } from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminShell } from '@/components/admin/admin-shell';
import { ROLE_LABELS_TH } from '@/components/admin/role-badge';
import { PasswordForm, ProfileForm } from './profile-client';

export const metadata: Metadata = { title: 'โปรไฟล์ของฉัน' };
export const dynamic = 'force-dynamic';

/**
 * /admin/profile — บัญชีของฉัน
 *
 * เจ้าหน้าที่ทุกบทบาทเข้าได้ (ไม่ใช่หน้า admin-only) เพราะเป็นข้อมูลของตัวเอง
 * การแก้บทบาท/หน่วยงาน/บัญชีคนอื่น อยู่ที่ /admin/users ซึ่งจำกัด head/superadmin
 *
 * § route ชื่อ profile ไม่ใช่ settings — sidebar แยกเมนูนี้ไว้ท้ายในฐานะ "ตัวฉัน"
 * ส่วน /admin/settings สงวนไว้ให้การตั้งค่าระดับระบบในอนาคต
 */
export default async function SettingsPage() {
  const { user: staffUser } = await requireStaff();
  const db = await getDb();

  const departmentName = staffUser.departmentId
    ? ((
        await firstOrUndefined(
          db
            .select({ name: departments.name })
            .from(departments)
            .where(eq(departments.id, staffUser.departmentId))
            .limit(1),
        )
      )?.name ?? null)
    : null;

  // อ่านค่าล่าสุดจาก DB — session อาจถูกออกก่อนที่ผู้ใช้จะแก้โปรไฟล์รอบก่อนหน้า
  const current = await firstOrUndefined(
    db
      .select({ fullName: users.fullName, phoneNumber: users.phoneNumber })
      .from(users)
      .where(eq(users.id, staffUser.id))
      .limit(1),
  );

  return (
    <AdminShell user={staffUser} active="profile" title="โปรไฟล์ของฉัน">
      <div className="space-y-6">
        <p className="text-sm text-muted">แก้ไขข้อมูลส่วนตัวและรหัสผ่านของคุณเอง</p>

        <div className="grid gap-6 lg:grid-cols-2">
          <ProfileForm
            fullName={current?.fullName ?? staffUser.fullName}
            phoneNumber={current?.phoneNumber ?? staffUser.phoneNumber}
            email={staffUser.email}
            roleLabel={ROLE_LABELS_TH[staffUser.role]}
            departmentName={departmentName}
          />
          <PasswordForm />
        </div>
      </div>
    </AdminShell>
  );
}
