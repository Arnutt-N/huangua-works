import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { ChatbotDashboardClient } from './chatbot-dashboard-client';

export const metadata: Metadata = { title: 'ภาพรวมบอท' };
export const dynamic = 'force-dynamic';

export default async function ChatbotDashboardPage() {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);

  return (
    <AdminShell user={staffUser} active="chatbot" title="ภาพรวมบอท">
      <div className="space-y-6">
        <p className="text-sm text-muted">
          สถิติการทำงานของแชทบอท: ปริมาณข้อความ, FAQ hit rate, handoff, คำถามยอดนิยม
        </p>
        <ChatbotDashboardClient />
      </div>
    </AdminShell>
  );
}
