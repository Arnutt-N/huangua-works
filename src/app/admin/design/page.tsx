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
          สลับธีมสว่าง/มืดได้จากเมนูมุมขวาบนแล้วตัวเลขจะอัปเดตตาม
        </p>
        <DesignClient />
      </div>
    </AdminShell>
  );
}
