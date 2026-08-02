import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { ReplyObjectsClient } from './reply-objects-client';

export const metadata: Metadata = { title: 'ข้อความสำเร็จรูป (Reply Objects)' };
export const dynamic = 'force-dynamic';

export default async function ReplyObjectsPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="reply-objects" title="ข้อความสำเร็จรูป">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          สร้าง flex/template/text สำเร็จรูป อ้างอิงด้วย $object_id ใน FAQ หรือ intent responses
        </p>
        <ReplyObjectsClient />
      </div>
    </AdminShell>
  );
}
