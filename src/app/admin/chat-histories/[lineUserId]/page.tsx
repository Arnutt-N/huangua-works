import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AdminShell } from '@/components/admin/admin-shell';
import { ChatHistoryDetail } from '../chat-histories-client';

export const metadata: Metadata = { title: 'ประวัติการสนทนา' };
export const dynamic = 'force-dynamic';

/**
 * § param ชื่อ lineUserId แต่ค่าคือ conversation id — ห้องคุย 1:1 ต่อผู้ใช้ LINE
 * (unique index บน chat_conversations.line_user_id_hash) ลิสต์จึงส่ง id ห้องมาตรง ๆ
 * masked id 8 ตัวอักษรย้อนกลับเป็นห้องไม่ได้ และห้ามสร้าง API ใหม่เพื่อ lookup
 * จึงไม่มีทางเลือกอื่นนอกจากคีย์ด้วย conversation id ภายใต้ชื่อ param เดิมของแผน
 */
export default async function ChatHistoryDetailPage({
  params,
}: {
  params: Promise<{ lineUserId: string }>;
}) {
  const { user: staffUser } = await requireStaff(ADMIN_ROLES);
  const { lineUserId } = await params;

  return (
    <AdminShell user={staffUser} active="chat-histories" title="ประวัติการสนทนา">
      <ChatHistoryDetail conversationId={lineUserId} />
    </AdminShell>
  );
}
