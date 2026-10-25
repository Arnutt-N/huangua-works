import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { FriendsHistoryClient } from './friends-history-client';

export const metadata: Metadata = { title: 'ประวัติเหตุการณ์เพื่อน' };
export const dynamic = 'force-dynamic';

export default async function FriendsHistoryPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="friends" title="ประวัติเหตุการณ์เพื่อน">
      <FriendsHistoryClient />
    </AdminShell>
  );
}
