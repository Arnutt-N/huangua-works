import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/require-staff';
import { ChatClient } from './chat-client';

export const metadata: Metadata = { title: 'แชท LINE' };
export const dynamic = 'force-dynamic';

/**
 * /admin/chat — live chat กับผู้ใช้ LINE
 *
 * หน้า full-screen แยกเดี่ยว (ไม่มี AdminShell) — 3 คอลัมน์ชิดขอบจอ
 * ปุ่ม Home ใน sidebar รายการแชทพากลับ /admin
 */
export default async function AdminChatPage() {
  const { user: staffUser } = await requireStaff();

  return <ChatClient adminUserId={staffUser.id} />;
}
