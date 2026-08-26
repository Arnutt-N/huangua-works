import type { Metadata } from 'next';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { categories, departments } from '@/lib/db/schema';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { CategoriesCard, DepartmentsCard } from './master-data-client';

export const metadata: Metadata = { title: 'หน่วยงาน / หมวดหมู่' };
export const dynamic = 'force-dynamic';

/**
 * /admin/master-data — ข้อมูลหลักของระบบ
 *
 * หน่วยงานและหมวดหมู่เป็นโครงที่ทุกเรื่องแจ้งอ้างถึง (cases.departmentId /
 * cases.categoryId) การแก้จึงกระทบทั้งระบบ — จำกัด head/superadmin เหมือน
 * /admin/users ส่วนการปิดใช้งานใช้แทนการลบเพื่อไม่ให้เรื่องเก่าอ้างถึงของที่หายไป
 */
export default async function MasterDataPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);
  const db = await getDb();

  const deptRows = await db
    .select({
      id: departments.id,
      name: departments.name,
      slug: departments.slug,
      description: departments.description,
      isActive: departments.isActive,
    })
    .from(departments)
    .orderBy(asc(departments.name));

  const catRows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      defaultDepartmentId: categories.defaultDepartmentId,
      defaultDepartmentName: departments.name,
      estimatedDays: categories.estimatedDays,
      isActive: categories.isActive,
    })
    .from(categories)
    .leftJoin(departments, eq(categories.defaultDepartmentId, departments.id))
    .orderBy(asc(categories.name));

  // dropdown "หน่วยงานเริ่มต้น" ให้เลือกเฉพาะหน่วยงานที่ยังใช้งานอยู่
  const activeDepts = deptRows
    .filter((d) => d.isActive)
    .map((d) => ({ id: d.id, name: d.name }));

  return (
    <AdminShell user={staffUser} active="master-data" title="หน่วยงาน / หมวดหมู่">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          ข้อมูลหลักที่ใช้ทั้งระบบ — หมวดหมู่แสดงในฟอร์มแจ้งเรื่องใหม่ของประชาชน
          ส่วนหน่วยงานใช้มอบหมายผู้รับผิดชอบ ปิดใช้งานแทนการลบเพื่อให้เรื่องเก่ายังอ่านได้
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          <DepartmentsCard rows={deptRows} />
          <CategoriesCard rows={catRows} departments={activeDepts} />
        </div>
      </div>
    </AdminShell>
  );
}
