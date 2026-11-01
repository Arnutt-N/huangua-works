'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import Link from 'next/link';
import { Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { BrandMark } from '@/components/site/brand-mark';
import { UserMenu } from '@/components/admin/user-menu';
import { SessionTimeoutWarning } from '@/components/admin/session-timeout-warning';
import {
  visibleNavGroups,
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
 *   - sidebar = นำทางทั้งระบบ (แบ่ง 3 กลุ่ม) — งานล้วน ไม่มีเรื่องของบัญชี
 *   - topbar  = ชื่อหน้าปัจจุบัน + เมนูผู้ใช้ (avatar dropdown: โปรไฟล์/ออกจากระบบ)
 *   - เนื้อหา = ตัวกรอง/ข้อมูลของหน้านั้น อยู่ในพื้นที่ของตัวเองชัดเจน
 *
 * § ความปลอดภัย: component นี้เป็น client จึงรับเฉพาะ field ที่ต้องแสดงผล
 * ห้ามรับ user ทั้ง row จาก Drizzle เพราะ passwordHash จะถูก serialize ลง RSC payload
 * แล้วหลุดไปถึง browser
 */
export interface AdminLayoutUser {
  fullName: string;
  email: string;
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
  const { isDesktop, hydrated } = useMediaQuery();
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // อ่านค่าที่ผู้ใช้เลือกไว้ครั้งก่อน — อ่านหลัง mount เพื่อเลี่ยง hydration mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage อ่านได้เฉพาะฝั่ง client หลัง mount เท่านั้น
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  // § repo นี้ไม่มี admin/layout.tsx — ทุกหน้า render <AdminShell> เองใน page
  // sidebar จึง remount ทุกครั้งที่เปลี่ยนหน้า และ nav เริ่ม scrollTop = 0 เสมอ
  // คลิกเมนูล่างๆ แล้วแถบเมนูเด้งกลับขึ้นบน มองไม่เห็นว่าอยู่ที่เมนูไหน
  // → เลื่อนเฉพาะ nav ให้ active item โผล่ (ไม่ใช้ scrollIntoView เพราะมันลาก
  //   window/page scroll ตามไปด้วย ทำให้เนื้อหาหน้ากระตุก)
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeEl = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!activeEl) return;
    // § เทียบ rect แทน offsetTop — offsetParent ของ item คือ <aside> (fixed) ไม่ใช่ nav
    const navRect = nav.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    if (elRect.top < navRect.top) {
      nav.scrollTop -= navRect.top - elRect.top;
    } else if (elRect.bottom > navRect.bottom) {
      nav.scrollTop += elRect.bottom - navRect.bottom;
    }
  }, [active]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }

  // ปิด drawer เมื่อกด Escape (คู่กับการปิดตอนคลิกลิงก์และคลิกฉากหลัง)
  // + โฟกัสเข้า drawer เมื่อเปิด, คืนให้ hamburger เมื่อปิด, กัก Tab ใน drawer
  useEffect(() => {
    if (!mobileOpen) return;
    asideRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        return;
      }
      // กัก Tab ใน drawer
      if (e.key === 'Tab' && asideRef.current) {
        const items = [...asideRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(
          (el) => el.offsetParent !== null,
        );
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // § คืนโฟกัสให้ hamburger เฉพาะตอนที่ drawer "ปิดหลังเคยเปิด" — ห้ามยิงตอน mount
  // ไม่งั้นทุกครั้งที่เข้า/เปลี่ยนหน้า admin บนมือถือ โฟกัสจะถูกกระชากจากตำแหน่งเริ่มต้น
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (mobileOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      hamburgerRef.current?.focus();
    }
  }, [mobileOpen]);

  const groups = visibleNavGroups(user.role);

  return (
    <div className="mesh-gradient relative min-h-dvh text-ink print:min-h-0 print:bg-white print:bg-none print:text-black">
      <div className="thai-pattern pointer-events-none fixed inset-0 print:hidden" aria-hidden="true" />

      {/* ── ฉากหลังของ drawer บนมือถือ ── */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden print:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="ปิดเมนู"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        ref={asideRef}
        // § ใส่ inert เฉพาะหลัง hydrate แล้วเท่านั้น — ระหว่าง SSR ยังไม่รู้ว่าเป็น desktop
        // หรือ mobile ถ้าใส่ไปเลยผู้ใช้ desktop จะกดเมนูไม่ได้จนกว่า JS จะทำงาน
        inert={hydrated && !isDesktop && !mobileOpen}
        className={cn(
          'glass-panel fixed inset-y-0 left-0 z-50 flex flex-col border-r shadow-lg',
          'transition-[width,transform] duration-normal ease-out-expo',
          collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64',
          'w-72 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'print:hidden',
        )}
        id="admin-sidebar"
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
            className="ml-auto flex h-11 w-11 flex-none items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong lg:hidden"
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
              'hidden h-11 w-11 flex-none items-center justify-center rounded-md text-muted hover:bg-accent-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong lg:flex',
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

        {/* เมนูงาน — แบ่งกลุ่มตามหน้าที่ */}
        <nav ref={navRef} className="flex-1 overflow-y-auto p-3">
          {groups.map((group, i) => (
            <div key={group.label} className={cn(i > 0 && 'mt-5')}>
              {/* หัวข้อกลุ่ม: ตอนย่อเปลี่ยนเป็นเส้นคั่นแทน — ถ้าซ่อนเฉย ๆ
                  ไอคอนทุกกลุ่มจะไหลติดกันจนแยกกลุ่มไม่ออก */}
              <p
                className={cn(
                  'px-3 pb-1.5 text-xs font-semibold tracking-wide text-muted',
                  collapsed && 'lg:hidden',
                )}
              >
                {group.label}
              </p>
              {collapsed && i > 0 && (
                <div className="mx-2 mb-2 hidden border-t border-border lg:block" aria-hidden="true" />
              )}
              <ul className="space-y-1">
                {group.items.map((item) => (
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
            </div>
          ))}
        </nav>
      </aside>

      {/* ── พื้นที่เนื้อหา ── */}
      <div
        className={cn(
          'relative z-10 flex min-h-dvh flex-col transition-[padding] duration-normal ease-out-expo',
          collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64',
          'print:m-0 print:min-h-0 print:pl-0',
        )}
      >
        {/* Topbar — แถวเดียว สูงคงที่ ไม่มีเมนูปน */}
        <header className="glass sticky top-0 z-30 flex h-16 flex-none items-center gap-3 border-b border-border px-4 sm:px-6 print:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-md text-ink hover:bg-accent-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong lg:hidden"
            ref={hamburgerRef}
            aria-label="เปิดเมนู"
            aria-expanded={mobileOpen}
            aria-controls="admin-sidebar"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-base font-bold text-ink sm:text-lg">
            {title}
          </h1>

          {/* เมนูผู้ใช้ — avatar dropdown: โปรไฟล์ของฉัน / ออกจากระบบ (ยืนยันก่อนออก)
              badge บทบาทแสดงใน dropdown ที่เดียว ไม่ซ้ำบน topbar */}
          <UserMenu fullName={user.fullName} email={user.email} role={user.role} />
        </header>

        <main id="main" className="flex-1">{children}</main>
      </div>

      <div className="print:hidden">
        <SessionTimeoutWarning />
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
