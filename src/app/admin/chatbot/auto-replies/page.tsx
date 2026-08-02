import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { AutoRepliesClient } from './auto-replies-client';

export const metadata: Metadata = { title: 'ตอบอัตโนมัติ (FAQ)' };
export const dynamic = 'force-dynamic';

export default async function AutoRepliesPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="auto-replies" title="ตอบอัตโนมัติ (FAQ)">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          จัดการคำถาม-คำตอบที่บอทใช้ตอบประชาชนอัตโนมัติ เพิ่ม keyword เพื่อให้บอทจับคู่ได้แม่นยำขึ้น
        </p>
        <AutoRepliesClient />
      </div>
    </AdminShell>
  );
}
