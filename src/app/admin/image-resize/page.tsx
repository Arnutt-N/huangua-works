import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { ImageResizeClient } from './image-resize-client';

export const metadata: Metadata = { title: 'ย่อรูป' };
export const dynamic = 'force-dynamic';

export default async function ImageResizePage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="image-resize" title="ย่อรูป">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          ย่อ/ปรับขนาดรูปตาม preset ของ LINE (Rich Menu 2500x1686, Image Message 1040x1040) แล้วอัปโหลดเข้า media library
        </p>
        <ImageResizeClient />
      </div>
    </AdminShell>
  );
}
