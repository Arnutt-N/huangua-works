import type { Metadata } from 'next';
import { Zap } from 'lucide-react';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { EmptyState } from '@/components/admin/empty-state';

export const metadata: Metadata = { title: 'ข้อความด่วน' };
export const dynamic = 'force-dynamic';

export default async function CannedResponsesPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="canned-responses" title="ข้อความด่วน">
      <EmptyState
        icon={Zap}
        title="ยังไม่มีข้อความด่วน"
        description="ข้อความที่ใช้บ่อยจะจัดการที่นี่ เรียกใช้ในช่องพิมพ์ด้วย / ตามด้วยคีย์ลัด"
      />
    </AdminShell>
  );
}
