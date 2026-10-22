import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { IntentDetailClient } from './intent-detail-client';

export const metadata: Metadata = { title: 'รายละเอียดหมวดเจตนา' };
export const dynamic = 'force-dynamic';

export default async function IntentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);
  const { id } = await params;

  return (
    <AdminShell user={staffUser} active="auto-replies" title="รายละเอียดหมวด">
      <IntentDetailClient intentId={id} />
    </AdminShell>
  );
}
