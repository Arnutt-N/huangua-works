import type { Metadata } from 'next';
import { History } from 'lucide-react';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { EmptyState } from '@/components/admin/empty-state';

export const metadata: Metadata = { title: 'ประวัติการสนทนา' };
export const dynamic = 'force-dynamic';

export default async function ChatHistoriesPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="chat-histories" title="ประวัติการสนทนา">
      <EmptyState
        icon={History}
        title="ยังไม่มีประวัติการสนทนา"
        description="บทสนทนาที่ปิดห้องแล้วจะแสดงที่นี่เพื่อค้นหาย้อนหลัง"
      />
    </AdminShell>
  );
}
