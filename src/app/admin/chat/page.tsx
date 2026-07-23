import { requireStaff } from '@/lib/auth/require-staff';
import { AdminChrome } from '@/components/admin/admin-chrome';
import { ChatClient } from './chat-client';

export const dynamic = 'force-dynamic';

export default async function AdminChatPage() {
  const { user: staffUser } = await requireStaff();

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <AdminChrome user={staffUser} active="chat" />
      <ChatClient adminUserId={staffUser.id} />
    </div>
  );
}
