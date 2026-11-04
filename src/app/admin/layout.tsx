import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminChrome } from '@/components/admin/admin-chrome';

/**
 * Root Layout ของ Admin (/admin)
 *
 * § Next.js App Router layout: persist สถานะ sidebar, drawer, และ scroll ข้ามหน้า
 * เพื่อป้องกัน sidebar remount และ UI flickering เมื่อสลับหน้าในระบบเจ้าหน้าที่
 *
 * § Public auth pages (/admin/login, /admin/forgot-password, /admin/reset-password)
 * ไม่มี session จะผ่าน layout นี้ออกไปตรงๆ โดยไม่เรียก requireStaff() เพื่อไม่ให้เกิด redirect loop
 *
 * § ส่งเฉพาะ sanitized fields (fullName, email, role) ให้ AdminChrome (client component)
 * เพื่อไม่ให้ passwordHash หลุดลงใน RSC payload
 */
export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    return <>{children}</>;
  }

  const { user } = await requireStaff();
  return (
    <AdminChrome user={{ fullName: user.fullName, email: user.email, role: user.role }}>
      {children}
    </AdminChrome>
  );
}
