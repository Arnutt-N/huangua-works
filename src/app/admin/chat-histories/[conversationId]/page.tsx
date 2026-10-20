import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { ChatHistoryDetail } from '../chat-histories-client';

export const metadata: Metadata = { title: 'ประวัติการสนทนา' };
export const dynamic = 'force-dynamic';

export default async function ChatHistoryDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);
  const { conversationId } = await params;

  return (
    <AdminShell user={staffUser} active="chat-histories" title="ประวัติการสนทนา">
      <ChatHistoryDetail conversationId={conversationId} />
    </AdminShell>
  );
}
