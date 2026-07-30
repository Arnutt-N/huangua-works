import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminShell } from '@/components/admin/admin-shell';
import { ChatClient } from './chat-client';

export const metadata: Metadata = { title: 'แชท LINE' };
export const dynamic = 'force-dynamic';

/**
 * /admin/chat — live chat กับผู้ใช้ LINE
 *
 * อยู่ใน AdminShell แบบ `bleed` — คง sidebar/topbar ของแอดมินไว้ แล้วให้ ChatClient
 * ขยายเต็มพื้นที่เนื้อหาแบบชิดขอบ (จัดความสูง/คอลัมน์เอง)
 */
export default async function AdminChatPage() {
  const { user: staffUser } = await requireStaff();

  return (
    <AdminShell user={staffUser} active="chat" title="แชท LINE" bleed>
      <ChatClient adminUserId={staffUser.id} />
    </AdminShell>
  );
}
