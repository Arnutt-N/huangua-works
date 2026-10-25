import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { ChatbotDashboardClient } from './chatbot-dashboard-client';

export const metadata: Metadata = { title: 'Chatbot Overview' };
export const dynamic = 'force-dynamic';

export default async function ChatbotDashboardPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="chatbot" title="Chatbot Overview">
      <ChatbotDashboardClient />
    </AdminShell>
  );
}
