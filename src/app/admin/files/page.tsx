import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { FilesClient } from './files-client';

export const metadata: Metadata = { title: 'ไฟล์สื่อ' };
export const dynamic = 'force-dynamic';

export default async function FilesPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="files" title="ไฟล์สื่อ">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          จัดการไฟล์สื่อ (รูป, เอกสาร) สำหรับใช้ใน Rich Menu, ข้อความภาพ, และอื่นๆ
        </p>
        <FilesClient />
      </div>
    </AdminShell>
  );
}
