import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { BroadcastWizardClient } from './broadcast-wizard-client';

export const metadata: Metadata = { title: 'สร้างประกาศ' };
export const dynamic = 'force-dynamic';

export default async function BroadcastNewPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="broadcast" title="สร้างประกาศ">
      <div className="mb-4">
        <Link
          href="/admin/chatbot/broadcast"
          className="text-sm font-semibold text-accent-strong hover:underline"
        >
          ← กลับประวัติ Broadcast
        </Link>
      </div>
      <BroadcastWizardClient />
    </AdminShell>
  );
}
