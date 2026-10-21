import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { RichMenuInsightsClient } from './insights-client';

export const metadata: Metadata = { title: 'สถิติ Rich Menu' };
export const dynamic = 'force-dynamic';

export default async function RichMenuInsightsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);
  const { id } = await params;

  return (
    <AdminShell user={staffUser} active="rich-menus" title="สถิติ Rich Menu">
      <RichMenuInsightsClient menuId={id} />
    </AdminShell>
  );
}
