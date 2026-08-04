import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { DesignClient } from './design-client';

export const metadata: Metadata = { title: 'ระบบดีไซน์' };
export const dynamic = 'force-dynamic';

export default async function DesignPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="design" title="ระบบดีไซน์">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          สี ส่วนประกอบ และผลตรวจ contrast ของระบบ — ค่าทั้งหมดอ่านจากที่เบราว์เซอร์แสดงจริง
          ใช้ปุ่มสลับธีมในการ์ดด้านล่างเพื่อดูค่าของธีมมืด
        </p>
        <DesignClient />
      </div>
    </AdminShell>
  );
}
