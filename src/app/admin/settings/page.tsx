import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { SettingsClient } from './settings-client';

export const metadata: Metadata = { title: 'ตั้งค่าบอท' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="settings" title="ตั้งค่าบอท">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          ตั้งค่าพฤติกรรมบอท: ข้อความต้อนรับ, keyword ส่งต่อเจ้าหน้าที่, เวลาทำการ
        </p>
        <SettingsClient />
      </div>
    </AdminShell>
  );
}
