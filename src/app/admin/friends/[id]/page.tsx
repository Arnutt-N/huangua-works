import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { FriendDetailClient } from './friend-detail-client';

export const metadata: Metadata = { title: 'รายละเอียดเพื่อน LINE' };
export const dynamic = 'force-dynamic';

export default async function FriendDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);
  const { id } = await params;

  return (
    <AdminShell user={staffUser} active="friends" title="รายละเอียดเพื่อน">
      <FriendDetailClient friendId={id} />
    </AdminShell>
  );
}
