import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { BroadcastClient } from './broadcast-client';

export const metadata: Metadata = { title: 'ส่งประกาศ (Broadcast)' };
export const dynamic = 'force-dynamic';

export default async function BroadcastPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="broadcast" title="ส่งประกาศ (Broadcast)">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          ส่งข้อความประกาศหาผู้ติดตาม LINE ทุกคน หรือตั้งเวลาส่งล่วงหน้า
        </p>
        <BroadcastClient />
      </div>
    </AdminShell>
  );
}
