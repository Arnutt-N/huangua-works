import type { Metadata } from 'next';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users, departments } from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminChrome } from '@/components/admin/admin-chrome';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPageTransition } from '@/components/admin/admin-page-transition';
import { UsersClient, UserSuccessToast } from './users-client';

export const metadata: Metadata = { title: 'จัดการผู้ใช้' };
export const dynamic = 'force-dynamic';

/**
 * /admin/users — user management (head/superadmin เท่านั้น)
 *
 * แสดงรายชื่อ + สร้าง/ระงับ/เปลี่ยน role/รีเซ็ตรหัสผ่าน
 * requireStaff(['head','superadmin']) enforce ที่ทุก action ด้วย
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { user: staffUser } = await requireStaff(['head', 'superadmin']);
  const { ok } = await searchParams;
  const db = await getDb();

  // fetch all users (staff + citizens — เพราะอาจมี citizen ที่ยังไม่ได้กำหนด)
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      departmentId: users.departmentId,
      departmentName: departments.name,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .orderBy(asc(users.fullName));

  const deptOptions = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.isActive, true))
    .orderBy(departments.name);

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <AdminChrome user={staffUser} active="users" />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <AdminPageTransition>
          <div className="space-y-6">
            <AdminPageHeader
              title="จัดการผู้ใช้"
              subtitle="สร้าง ระงับ แก้ไขบทบาท และรีเซ็ตรหัสผ่านของบัญชีเจ้าหน้าที่"
            />
            <UserSuccessToast ok={ok ?? null} />
            <UsersClient
              users={userRows.map((r) => ({
                ...r,
                departmentId: r.departmentId,
                departmentName: r.departmentName,
              }))}
              departments={deptOptions}
              canResetPassword={staffUser.role === 'superadmin'}
              currentUserId={staffUser.id}
            />
          </div>
        </AdminPageTransition>
      </main>
    </div>
  );
}
