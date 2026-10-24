import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { ReplyObjectsClient } from './reply-objects-client';

export const metadata: Metadata = { title: 'Reply Objects' };
export const dynamic = 'force-dynamic';

export default async function ReplyObjectsPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="reply-objects" title="Reply Objects">
      <ReplyObjectsClient />
    </AdminShell>
  );
}
