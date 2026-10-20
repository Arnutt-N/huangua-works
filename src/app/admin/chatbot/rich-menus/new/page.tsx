import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { RichMenuBuilderClient } from './rich-menu-builder-client';

export const metadata: Metadata = { title: 'สร้าง Rich Menu' };
export const dynamic = 'force-dynamic';

export default async function RichMenuNewPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="rich-menus" title="สร้าง Rich Menu">
      <div className="mb-4">
        <Link
          href="/admin/chatbot/rich-menus"
          className="text-sm font-semibold text-accent-strong hover:underline"
        >
          ← กลับ Rich Menus
        </Link>
      </div>
      <RichMenuBuilderClient />
    </AdminShell>
  );
}
