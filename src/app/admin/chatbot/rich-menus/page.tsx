import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { RichMenusClient } from './rich-menus-client';

export const metadata: Metadata = { title: 'Rich Menu' };
export const dynamic = 'force-dynamic';

export default async function RichMenusPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="rich-menus" title="Rich Menu">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          จัดการ Rich Menu ของ LINE — สร้าง, sync ไป LINE, และ publish ให้ผู้ใช้ทุกคน
        </p>
        <RichMenusClient />
      </div>
    </AdminShell>
  );
}
