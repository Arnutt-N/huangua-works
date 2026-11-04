import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { NewReplyObjectClient } from './new-reply-object-client';

export const metadata: Metadata = { title: 'สร้างรูปแบบคำตอบ' };
export const dynamic = 'force-dynamic';

export default async function NewReplyObjectPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="reply-objects" title="สร้างรูปแบบคำตอบ">
      <NewReplyObjectClient />
    </AdminShell>
  );
}
