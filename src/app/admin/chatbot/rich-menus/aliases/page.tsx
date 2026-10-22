import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { RichMenuAliasesClient } from './aliases-client';

export const metadata: Metadata = { title: 'Rich Menu Aliases' };
export const dynamic = 'force-dynamic';

export default async function RichMenuAliasesPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="rich-menus" title="Rich Menu Aliases">
      <RichMenuAliasesClient />
    </AdminShell>
  );
}
