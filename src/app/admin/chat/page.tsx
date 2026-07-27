import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminShell } from '@/components/admin/admin-shell';
import { ChatClient } from './chat-client';

export const metadata: Metadata = { title: 'แชท LINE' };
export const dynamic = 'force-dynamic';

/**
 * /admin/chat — live chat กับผู้ใช้ LINE
 *
 * ใช้ AdminShell แบบ `bleed` เพราะ ChatClient จัดความสูง/คอลัมน์เต็มพื้นที่เอง
 * (หน้าอื่นให้ shell คุม container + padding ให้)
 */
export default async function AdminChatPage() {
  const { user: staffUser } = await requireStaff();

  return (
    <AdminShell user={staffUser} active="chat" bleed>
      <ChatClient adminUserId={staffUser.id} />
    </AdminShell>
  );
}
