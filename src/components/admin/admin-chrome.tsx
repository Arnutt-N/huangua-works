'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AdminLayout, type AdminLayoutUser } from '@/components/admin/admin-layout';
import { AdminPageTransition } from '@/components/admin/admin-page-transition';
import { resolveAdminChrome } from '@/components/admin/admin-nav';
import { cn } from '@/lib/cn';

/**
 * โครงที่อยู่ใน layout — คำนวณแท็บและชื่อหน้าจาก pathname
 * เพื่อให้ sidebar (client state) ไม่ถูกสร้างใหม่ตอนเปลี่ยนหน้า
 */
export function AdminChrome({
  user,
  children,
  className,
}: {
  user: AdminLayoutUser;
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname() || '/admin';
  const chrome = resolveAdminChrome(pathname);

  return (
    <AdminLayout user={user} active={chrome.active} title={chrome.title}>
      <div
        className={cn(
          !chrome.bleed &&
            'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 print:m-0 print:max-w-none print:w-full print:p-0',
          className,
        )}
      >
        <AdminPageTransition key={pathname}>{children}</AdminPageTransition>
      </div>
    </AdminLayout>
  );
}
