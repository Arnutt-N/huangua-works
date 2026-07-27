import type { ReactNode } from 'react';
import { AdminChrome, type AdminTab } from '@/components/admin/admin-chrome';
import { AdminPageTransition } from '@/components/admin/admin-page-transition';
import { cn } from '@/lib/cn';
import type { users } from '@/lib/db/schema';

/**
 * AdminShell — โครงหน้าเดียวของทุกหน้าแอดมิน
 *
 * เดิมทุกหน้า copy โครง `min-h-dvh bg-surface` + <AdminChrome> + <main> + <AdminPageTransition>
 * เองทีละหน้า ทำให้ค่าคลาดกันไปเรื่อย ๆ (เช่น /admin/cases/[id] ไม่มี transition,
 * /admin/chat ไม่มี main container) รวมไว้ที่เดียวเพื่อ consistency จริง
 *
 * § พื้นหลัง — เหตุผลที่แอดมินเดิม "ดูยาก"
 * bg-surface (L99%) กับการ์ด bg-surface-raised (L100%) ต่างกัน 1% = แทบไม่มีการแยกชั้น
 * รวมกับขอบ 1.31:1 ที่มองไม่เห็น หน้าจอเลยแบนราบทั้งหน้า
 * เปลี่ยนมาใช้ mesh-gradient + thai-pattern ชุดเดียวกับ Hero/หน้า login แล้ววาง
 * การ์ด .glass-panel ทับ → ได้ทั้งความลึกและภาษาเดียวกับ landing
 *
 * `bleed` = ปิด container/padding ของ main สำหรับหน้าที่จัดพื้นที่เอง (เช่น /admin/chat)
 */
export function AdminShell({
  user,
  active,
  children,
  bleed = false,
  className,
}: {
  user: typeof users.$inferSelect;
  active: AdminTab;
  children: ReactNode;
  bleed?: boolean;
  className?: string;
}) {
  return (
    <div className="mesh-gradient relative min-h-dvh text-ink">
      {/* ลาย Thai pattern จาง ๆ (opacity .04) — ตัวเดียวกับ Hero, ไม่รับ pointer event */}
      <div className="thai-pattern pointer-events-none fixed inset-0" aria-hidden="true" />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <AdminChrome user={user} active={active} />
        <main
          className={cn(
            'flex-1',
            !bleed && 'mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10',
            className,
          )}
        >
          <AdminPageTransition>{children}</AdminPageTransition>
        </main>
      </div>
    </div>
  );
}
