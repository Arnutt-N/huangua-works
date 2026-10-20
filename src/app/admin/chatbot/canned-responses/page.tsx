import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { CannedResponsesClient } from './canned-responses-client';

export const metadata: Metadata = { title: 'ข้อความด่วน' };
export const dynamic = 'force-dynamic';

export default async function CannedResponsesPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="canned-responses" title="ข้อความด่วน">
      <CannedResponsesClient />
    </AdminShell>
  );
}
