import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { HealthClient } from './health-client';

export const metadata: Metadata = { title: 'สุขภาพระบบ' };
export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="health" title="สุขภาพระบบ">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          ตรวจสอบสถานะบริการ: Database, Redis, LINE API, LIFF Config — auto-refresh ทุก 30 วินาที
        </p>
        <HealthClient />
      </div>
    </AdminShell>
  );
}
