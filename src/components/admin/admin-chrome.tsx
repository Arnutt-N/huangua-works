import Link from 'next/link';
import { LayoutDashboard, LogOut, BarChart3, Users, ScrollText, MessageSquare } from 'lucide-react';
import { logout } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { users, userRoleEnum } from '@/lib/db/schema';

type UserRole = (typeof userRoleEnum.enumValues)[number];

/**
 * AdminChrome — header + nav tabs สำหรับ protected admin pages
 *
 * ใช้เป็น shared component ทุก admin page (ไม่ใช้ /admin/layout.tsx เพราะจะครอบ /admin/login)
 *
 * Nav tabs:
 *  - แดชบอร์ด (/admin) — ทุก staff
 *  - รายงาน (/admin/reports) — ทุก staff
 *  - ผู้ใช้งาน (/admin/users) — head/superadmin เท่านั้น
 *  - ประวัติ (/admin/audit) — ทุก staff
 *
 * `active` prop ระบุ tab ปัจจุบัน — explicit จากแต่ละ page (สะอาดกว่า headers() parsing)
 */
export type AdminTab = 'dashboard' | 'reports' | 'chat' | 'users' | 'audit';

const SUPERVISOR_ROLES: UserRole[] = ['head', 'superadmin'];

interface NavItem {
  key: AdminTab;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  supervisorOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'แดชบอร์ด', href: '/admin', icon: LayoutDashboard },
  { key: 'reports', label: 'รายงาน', href: '/admin/reports', icon: BarChart3 },
  { key: 'chat', label: 'แชท LINE', href: '/admin/chat', icon: MessageSquare },
  { key: 'users', label: 'ผู้ใช้งาน', href: '/admin/users', icon: Users, supervisorOnly: true },
  { key: 'audit', label: 'ประวัติ', href: '/admin/audit', icon: ScrollText },
];

export function AdminChrome({
  user,
  active,
}: {
  user: typeof users.$inferSelect;
  active: AdminTab;
}) {
  const isSupervisor = SUPERVISOR_ROLES.includes(user.role);
  const visibleItems = NAV_ITEMS.filter((item) => !item.supervisorOnly || isSupervisor);

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Row 1: brand + user + logout */}
        <div className="flex min-h-touch items-center justify-between gap-3">
          <Link href="/admin" className="flex items-center gap-2.5">
            <LayoutDashboard className="h-5 w-5 text-accent-strong" aria-hidden="true" />
            <span className="flex flex-col leading-none">
              <span className="text-base font-bold tracking-tight text-ink">
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

        {/* Row 2: nav tabs (md+ เท่านั้น — mobile ใช้ compact horizontal scroll) */}
        <nav aria-label="นำทางหลัก">
          <ul className="flex items-center gap-1 overflow-x-auto">
            {visibleItems.map((item) => {
              const isActive = item.key === active;
              const Icon = item.icon;
              return (
                <li key={item.key} className="flex-none">
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex min-h-touch items-center gap-2 whitespace-nowrap border-b-2 px-4 text-sm font-semibold transition-colors duration-normal ease-out-expo',
                      isActive
                        ? 'border-accent-strong text-accent-strong'
                        : 'border-transparent text-muted hover:border-border-strong hover:text-ink',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
