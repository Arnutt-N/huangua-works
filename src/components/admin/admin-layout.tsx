'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Menu,
  X,
  LogOut,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { logout } from '@/app/admin/actions';
import { BrandMark } from '@/components/site/brand-mark';
import { RoleBadge } from '@/components/admin/role-badge';
import {
  ADMIN_NAV_ACCOUNT,
  ADMIN_NAV_MAIN,
  initialsOf,
  visibleNavItems,
  type AdminNavItem,
  type AdminTab,
  type UserRole,
} from '@/components/admin/admin-nav';
import { cn } from '@/lib/cn';

/**
 * AdminLayout — โครง sidebar + topbar ของแอดมิน
 *
 * § ทำไมย้ายจาก top-nav มาเป็น sidebar
 * โครงเดิมเป็น header สองแถว (แบรนด์+ผู้ใช้ / แท็บ) แล้วหน้า /admin ยังมีแถบตัวกรอง
 * ต่อลงมาอีกชั้น รวมเป็นสามแถบซ้อนกันติดขอบบน จนแยกไม่ออกว่าอะไรเป็นเมนูของทั้งระบบ
 * อะไรเป็นตัวกรองของหน้านี้ — และปุ่มที่ลอยอยู่บน header (ไอคอนลิงก์ออกเว็บ, ออกจากระบบ)
 * ก็อ่านเป็นปุ่มแปลกปลอมเพราะไม่มีกลุ่มรองรับ
 *
 * โครงใหม่แยกหน้าที่ชัดเจน:
 *   - sidebar = นำทางทั้งระบบ + บัญชีของฉัน (คงที่ ไม่เปลี่ยนตามหน้า)
 *   - topbar  = ชื่อหน้าปัจจุบัน + ตัวตนผู้ใช้ (บางแถวเดียว)
 *   - เนื้อหา = ตัวกรอง/ข้อมูลของหน้านั้น อยู่ในพื้นที่ของตัวเองชัดเจน
 *
 * § ความปลอดภัย: component นี้เป็น client จึงรับเฉพาะ field ที่ต้องแสดงผล
 * ห้ามรับ user ทั้ง row จาก Drizzle เพราะ passwordHash จะถูก serialize ลง RSC payload
 * แล้วหลุดไปถึง browser
 */
export interface AdminLayoutUser {
  fullName: string;
  role: UserRole;
}

const COLLAPSE_KEY = 'admin:sidebar-collapsed';

export function AdminLayout({
  user,
  active,
  title,
  children,
}: {
  user: AdminLayoutUser;
  active: AdminTab;
  title: string;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // อ่านค่าที่ผู้ใช้เลือกไว้ครั้งก่อน — อ่านหลัง mount เพื่อเลี่ยง hydration mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage อ่านได้เฉพาะฝั่ง client หลัง mount เท่านั้น
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }

  // ปิด drawer เมื่อกด Escape (คู่กับการปิดตอนคลิกลิงก์และคลิกฉากหลัง)
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const mainItems = visibleNavItems(user.role, ADMIN_NAV_MAIN);
  const accountItems = visibleNavItems(user.role, ADMIN_NAV_ACCOUNT);

  return (
    <div className="mesh-gradient relative min-h-dvh text-ink">
      <div className="thai-pattern pointer-events-none fixed inset-0" aria-hidden="true" />

      {/* ── ฉากหลังของ drawer บนมือถือ ── */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="ปิดเมนู"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'glass-panel fixed inset-y-0 left-0 z-50 flex flex-col border-r shadow-lg',
          'transition-[width,transform] duration-normal ease-out-expo',
          collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64',
          'w-72 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="นำทางหลัก"
      >
        {/* แบรนด์ */}
        <div className="flex h-16 flex-none items-center gap-2.5 border-b border-border px-4">
          {/* § ตอนย่อ: ซ่อนตราบนจอใหญ่
              รางกว้าง 4.5rem (72px) หัก padding แล้วเหลือ ~40px ใส่ได้แค่ปุ่มเดียว
              ถ้าเก็บตราไว้ด้วย ปุ่มขยายจะถูกดันตกออกนอกกรอบจนมองไม่เห็นและกดไม่ได้
              → ย่อแล้วขยายกลับไม่ได้เลย ตราไม่หายจริงเพราะยังอยู่บน drawer มือถือ */}
          <Link
            href="/admin"
            className={cn(
              'flex min-w-0 items-center gap-2.5',
              collapsed && 'lg:hidden',
            )}
            onClick={() => setMobileOpen(false)}
          >
            <BrandMark size="sm" />
            {/* § collapsed เป็นสถานะของ sidebar ฝั่ง desktop เท่านั้น
                จึงซ่อนข้อความด้วยคลาส lg: ไม่ใช่ตัดออกจาก DOM — ไม่งั้น drawer
                บนมือถือ (ซึ่งกว้างเต็มที่เสมอ) จะเหลือแต่ไอคอนโดยไม่มีป้ายกำกับ */}
            <span className={cn('min-w-0', collapsed && 'lg:hidden')}>
              <span className="block truncate text-sm font-bold text-ink">
                อบต.หัวงัว
              </span>
              <span className="block truncate text-xs text-muted">ระบบเจ้าหน้าที่</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto flex h-9 w-9 flex-none items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-ink lg:hidden"
            aria-label="ปิดเมนู"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* ย่อ/ขยาย — วางเป็นไอคอนคู่กับแบรนด์ ไม่ให้กินที่เป็นเมนูเต็มแถวปนกับ
              รายการนำทางจริงด้านล่าง (ผู้ใช้กดครั้งเดียวแล้วแทบไม่กดอีก) */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              'hidden h-9 w-9 flex-none items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-ink lg:flex',
              collapsed ? 'lg:mx-auto' : 'lg:ml-auto',
            )}
            aria-label={collapsed ? 'ขยายแถบเมนู' : 'ย่อแถบเมนู'}
            title={collapsed ? 'ขยายแถบเมนู' : 'ย่อแถบเมนู'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* เมนูงาน */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {mainItems.map((item) => (
              <li key={item.key}>
                <SidebarLink
                  item={item}
                  isActive={item.key === active}
                  collapsed={collapsed}
                  onNavigate={() => setMobileOpen(false)}
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* บัญชีของฉัน + ออกจากระบบ
            ปุ่มที่เคยลอยอยู่บน header ย้ายมารวมกลุ่มกันที่นี่ */}
        <div className="flex-none space-y-1 border-t border-border p-3">
          {accountItems.map((item) => (
            <SidebarLink
              key={item.key}
              item={item}
              isActive={item.key === active}
              collapsed={collapsed}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}

          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? 'เปิดหน้าเว็บสาธารณะ' : undefined}
            className={cn(
              'flex min-h-touch items-center gap-3 rounded-md px-3 text-sm font-medium text-muted transition-colors duration-normal ease-out-expo hover:bg-accent-sunken hover:text-accent-strong',
              collapsed && 'lg:justify-center lg:px-0',
            )}
          >
            <ExternalLink className="h-5 w-5 flex-none" aria-hidden="true" />
            <span className={cn('truncate', collapsed && 'lg:hidden')}>
              เปิดหน้าเว็บสาธารณะ
            </span>
          </Link>

          <form action={logout}>
            <button
              type="submit"
              title={collapsed ? 'ออกจากระบบ' : undefined}
              className={cn(
                'flex w-full min-h-touch items-center gap-3 rounded-md px-3 text-sm font-medium text-muted transition-colors duration-normal ease-out-expo hover:bg-danger-soft hover:text-danger-ink',
                collapsed && 'lg:justify-center lg:px-0',
              )}
            >
              <LogOut className="h-5 w-5 flex-none" aria-hidden="true" />
              <span className={cn('truncate', collapsed && 'lg:hidden')}>ออกจากระบบ</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ── พื้นที่เนื้อหา ── */}
      <div
        className={cn(
          'relative z-10 flex min-h-dvh flex-col transition-[padding] duration-normal ease-out-expo',
          collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64',
        )}
      >
        {/* Topbar — แถวเดียว สูงคงที่ ไม่มีเมนูปน */}
        <header className="glass sticky top-0 z-30 flex h-16 flex-none items-center gap-3 border-b border-border px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-md text-ink hover:bg-accent-sunken lg:hidden"
            aria-label="เปิดเมนู"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-base font-bold text-ink sm:text-lg">
            {title}
          </h1>

          {/* ตัวตนผู้ใช้อย่างเดียว — ไม่มีปุ่มสั่งการ (ย้ายไปรวมที่ sidebar แล้ว) */}
          <div className="flex flex-none items-center gap-2">
            <span className="hidden text-right sm:block">
              <span className="block max-w-[12rem] truncate text-sm font-semibold text-ink">
                {user.fullName}
              </span>
            </span>
            <RoleBadge role={user.role} className="hidden md:inline-flex" />
            <span
              aria-hidden="true"
              className="bg-accent-gradient-br flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-bold text-on-accent"
            >
              {initialsOf(user.fullName)}
            </span>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: AdminNavItem;
  isActive: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex min-h-touch items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors duration-normal ease-out-expo',
        collapsed && 'lg:justify-center lg:px-0',
        isActive
          ? 'bg-accent-strong text-on-accent shadow-sm'
          : 'text-muted hover:bg-accent-sunken hover:text-accent-strong',
      )}
    >
      <Icon className="h-5 w-5 flex-none" aria-hidden="true" />
      <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
    </Link>
  );
}
