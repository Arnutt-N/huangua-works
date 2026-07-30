import type { ReactNode } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageTransition } from '@/components/admin/admin-page-transition';
import type { AdminTab } from '@/components/admin/admin-nav';
import { cn } from '@/lib/cn';
import type { users } from '@/lib/db/schema';

/**
 * AdminShell — โครงหน้าเดียวของทุกหน้าแอดมิน (server component)
 *
 * รวมโครงที่ 6 หน้าเคย copy กันเอง แล้วส่งต่อให้ AdminLayout (client) ซึ่งคุม
 * สถานะ sidebar ย่อ/ขยาย และ drawer บนมือถือ
 *
 * § ส่งเฉพาะ field ที่ต้องใช้แสดงผลลง client
 * users.$inferSelect มี passwordHash อยู่ด้วย ถ้าส่งทั้ง row ให้ client component
 * ค่านั้นจะถูก serialize ลง RSC payload และอ่านได้จาก browser — จึงคัดเฉพาะ
 * fullName, email (ของเจ้าของบัญชีเอง — หน้า profile ก็แสดง) กับ role เท่านั้น
 *
 * `bleed` = ปิด container/padding ของ main สำหรับหน้าที่จัดพื้นที่เอง (เช่น /admin/chat)
 */
export function AdminShell({
  user,
  active,
  title,
  children,
  bleed = false,
  className,
}: {
  user: typeof users.$inferSelect;
  active: AdminTab;
  /** ชื่อหน้าที่แสดงบน topbar */
  title: string;
  children: ReactNode;
  bleed?: boolean;
  className?: string;
}) {
  return (
    <AdminLayout
      user={{ fullName: user.fullName, email: user.email, role: user.role }}
      active={active}
      title={title}
    >
      <div
        className={cn(
          !bleed && 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8',
          className,
        )}
      >
        <AdminPageTransition>{children}</AdminPageTransition>
      </div>
    </AdminLayout>
  );
}
