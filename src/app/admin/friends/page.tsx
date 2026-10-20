import type { Metadata } from 'next';
import { UsersRound } from 'lucide-react';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { EmptyState } from '@/components/admin/empty-state';

export const metadata: Metadata = { title: 'เพื่อน LINE' };
export const dynamic = 'force-dynamic';

export default async function FriendsPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="friends" title="เพื่อน LINE">
      <EmptyState
        icon={UsersRound}
        title="ยังไม่มีรายชื่อเพื่อน"
        description="ผู้ติดตาม LINE OA จะแสดงที่นี่พร้อมสถานะติดตาม"
      />
    </AdminShell>
  );
}
