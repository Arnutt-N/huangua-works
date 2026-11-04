import type { ReactNode } from 'react';
import type { AdminTab } from '@/components/admin/admin-nav';
import type { users } from '@/lib/db/schema';

/**
 * AdminShell: โครงหน้าสำหรับแอดมิน (server component)
 *
 * § โครงสร้าง layout จริง (AdminChrome + AdminLayout + sidebar + topbar)
 * ย้ายไปอยู่ที่ src/app/admin/layout.tsx เพื่อให้ Next.js persist sidebar ข้ามหน้า
 * โดยไม่ remount และคงสถานะ scroll/focus ไว้
 *
 * คอมโพเนนต์นี้ทำหน้าที่ pass-through children เพื่อรองรับหน้าเดิมและ test mocks
 */
export function AdminShell({
  children,
}: {
  user?: typeof users.$inferSelect;
  active?: AdminTab;
  /** ชื่อหน้าที่แสดงบน topbar */
  title?: string;
  children: ReactNode;
  bleed?: boolean;
  className?: string;
}) {
  return <>{children}</>;
}
