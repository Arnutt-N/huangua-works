import Link from 'next/link';
import {
  LayoutDashboard,
  LogOut,
  BarChart3,
  Users,
  ScrollText,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { logout } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/site/brand-mark';
import { RoleBadge } from '@/components/admin/role-badge';
import { cn } from '@/lib/cn';
import type { users, userRoleEnum } from '@/lib/db/schema';

type UserRole = (typeof userRoleEnum.enumValues)[number];

/**
 * AdminChrome — header + nav tabs สำหรับ protected admin pages
 *
 * ใช้เป็น shared component ทุก admin page (ไม่ใช้ /admin/layout.tsx เพราะจะครอบ /admin/login)
 *
 * ดีไซน์: glass sticky bar + BrandMark เดียวกับ landing Navbar → แอดมินกับหน้าเว็บสาธารณะ
 * อ่านเป็นผลิตภัณฑ์เดียวกัน (เดิมแอดมินเป็น bg-surface ทึบ + ไอคอน dashboard คนละตัว)
 *
 * § กฎ "หนึ่งบรรทัดต่อหนึ่งช่อง"
 * ของเดิมซ้อนข้อความ 2 บรรทัดไว้สองจุด (แบรนด์: ชื่อ+"อบต.หัวงัว", ผู้ใช้: ชื่อ+role)
 * ในแถวสูง min-h-touch (44px) — พอชื่อผู้ใช้ยาวหรือจอแคบ บรรทัดจะดันความสูงแถว
 * และตัดคำหล่นลงมา ทุกช่องในบาร์นี้จึงบังคับบรรทัดเดียว: whitespace-nowrap + truncate
 * และซ่อนส่วนที่ไม่จำเป็นตาม breakpoint แทนการปล่อยให้ห่อบรรทัด
 *
 * Nav tabs:
 *  - แดชบอร์ด (/admin) — ทุก staff
 *  - รายงาน (/admin/reports) — ทุก staff
 *  - แชท LINE (/admin/chat) — ทุก staff
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

/** คำนำหน้าชื่อไทยที่ไม่ควรกลายเป็นอักษรย่อบน avatar */
const NAME_PREFIXES = ['นางสาว', 'น.ส.', 'นาย', 'นาง', 'ดร.', 'ว่าที่'];

/**
 * อักษรย่อสำหรับ avatar — ตัดคำนำหน้าออกก่อน แล้วเอาอักษรแรกของสองคำแรก
 * (นายสมชาย ใจดี → "สใ") ถ้ามีคำเดียวก็ใช้สองอักษรแรกของคำนั้น
 */
function initialsOf(fullName: string): string {
  let name = fullName.trim();
  for (const prefix of NAME_PREFIXES) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length).trim();
      break;
    }
  }
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return [...words[0]!].slice(0, 2).join('');
  return (words[0]![0] ?? '') + (words[1]![0] ?? '');
}

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
    <header className="glass sticky top-0 z-50 border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* ── แถว 1: แบรนด์ + ผู้ใช้ + ออกจากระบบ (สูงคงที่ h-16 บรรทัดเดียวทั้งแถว) ── */}
        <div className="flex h-16 items-center justify-between gap-3">
          <Link
            href="/admin"
            className="flex min-w-0 items-center gap-2.5"
            aria-label="แดชบอร์ดเจ้าหน้าที่ อบต.หัวงัว"
          >
            <BrandMark />
            {/* บรรทัดเดียวเสมอ — ยาวเกินให้ตัดด้วย truncate ไม่ห่อบรรทัด */}
            <span className="hidden truncate text-base font-bold tracking-tight text-ink sm:block">
              แดชบอร์ดเจ้าหน้าที่
            </span>
            <span className="hidden whitespace-nowrap text-sm text-muted lg:inline">
              · อบต.หัวงัว
            </span>
          </Link>

          <div className="flex flex-none items-center gap-2 sm:gap-3">
            {/* ผู้ใช้: avatar + ชื่อ + บทบาท เรียงแนวนอนบรรทัดเดียว (เดิมซ้อน 2 บรรทัด) */}
            <span className="hidden min-w-0 items-center gap-2 rounded-pill border border-border bg-surface-raised/70 py-1 pr-3 pl-1 md:inline-flex">
              <span
                aria-hidden="true"
                className="bg-accent-gradient-br flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-bold text-on-accent"
              >
                {initialsOf(user.fullName)}
              </span>
              <span className="max-w-[9rem] truncate text-sm font-semibold text-ink">
                {user.fullName}
              </span>
              <RoleBadge role={user.role} className="flex-none" />
            </span>

            <Link
              href="/"
              className="hidden min-h-touch min-w-touch items-center justify-center rounded-md text-muted transition-colors hover:bg-accent-sunken hover:text-accent-strong sm:inline-flex"
              aria-label="เปิดหน้าเว็บสาธารณะ"
              title="เปิดหน้าเว็บสาธารณะ"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>

            <form action={logout}>
              <Button type="submit" variant="outline" size="sm" aria-label="ออกจากระบบ">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden whitespace-nowrap sm:inline">ออกจากระบบ</span>
              </Button>
            </form>
          </div>
        </div>

        {/* ── แถว 2: nav tabs — pill active สี accent-strong (คอนทราสต์ 6.5:1)
             แทน underline 2px เดิมที่แทบมองไม่เห็นบนพื้นอ่อน ── */}
        <nav aria-label="นำทางหลัก" className="-mx-1">
          <ul className="scrollbar-none flex items-center gap-1 overflow-x-auto px-1 pb-2">
            {visibleItems.map((item) => {
              const isActive = item.key === active;
              const Icon = item.icon;
              return (
                <li key={item.key} className="flex-none">
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex min-h-touch items-center gap-2 whitespace-nowrap rounded-pill px-4 text-sm font-semibold transition-colors duration-normal ease-out-expo',
                      isActive
                        ? 'bg-accent-strong text-on-accent shadow-sm'
                        : 'text-muted hover:bg-accent-sunken hover:text-accent-strong',
                    )}
                  >
                    <Icon className="h-4 w-4 flex-none" aria-hidden="true" />
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
