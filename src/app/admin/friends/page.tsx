import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { FriendsClient } from './friends-client';

export const metadata: Metadata = { title: 'เพื่อน LINE' };
export const dynamic = 'force-dynamic';

export default async function FriendsPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="friends" title="เพื่อน LINE">
      <FriendsClient />
    </AdminShell>
  );
}
