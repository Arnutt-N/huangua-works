import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { BroadcastDetailClient } from './broadcast-detail-client';

export const metadata: Metadata = { title: 'รายละเอียด Broadcast' };
export const dynamic = 'force-dynamic';

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);
  const { id } = await params;

  return (
    <AdminShell user={staffUser} active="broadcast" title="รายละเอียด Broadcast">
      <BroadcastDetailClient broadcastId={id} />
    </AdminShell>
  );
}
