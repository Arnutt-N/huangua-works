import Link from 'next/link';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { logout } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import type { users } from '@/lib/db/schema';

/**
 * AdminChrome — header/nav สำหรับ protected admin pages
 *
 * ใช้เป็น shared component แทน layout (เพราะ layout ที่ /admin/layout.tsx
 * จะครอบ /admin/login ด้วย — และ login page ใช้ SiteHeader ของตัวเอง)
 *
 * Page ที่ใช้: requireStaff() → render <AdminChrome user={user}> children </AdminChrome>
 *
 * Pattern:
 * ```tsx
 * const { user } = await requireStaff();
 * return (
 *   <div className="min-h-dvh bg-surface text-ink">
 *     <AdminChrome user={user} />
 *     <main>{...}</main>
 *   </div>
 * );
 * ```
 */
export function AdminChrome({ user }: { user: typeof users.$inferSelect }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex min-h-touch w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/admin" className="flex items-center gap-2.5">
          <LayoutDashboard className="h-5 w-5 text-accent-strong" aria-hidden="true" />
          <span className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">
              แดชบอร์ดเจ้าหน้าที่
            </span>
            <span className="mt-0.5 text-xs text-muted">อบต.หัวงัว</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden text-right text-sm sm:block">
            <p className="font-semibold text-ink">{user.fullName}</p>
            <p className="text-muted">{user.role}</p>
          </div>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm" aria-label="ออกจากระบบ">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
