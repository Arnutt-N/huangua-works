'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Menu, X, Search } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Navbar หลักของหน้า landing (/)
 *
 * ลิงก์ทั้งหมดชี้ไป route จริง (ไม่ใช่ anchor #tracking ที่ไม่มีอยู่):
 *  - ปุ่ม "แจ้งเหตุ" / "แจ้งเหตุออนไลน์"  → /intake
 *  - ปุ่ม "ติดตามงาน"                    → /track
 *
 * Anchor (#home/#services/#how-it-works) ยังใช้ต่อเพราะมี section id จริงในหน้า landing
 * (ดู page.tsx — Hero มี id="home", Services มี id="services", HowItWorks มี id="how-it-works")
 *
 * Mobile menu: ปิดเมนูอัตโนมัติเมื่อคลิกลิงก์ (closeOnNavigate)
 */
export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="glass fixed top-0 left-0 right-0 z-50 border-b">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{
                background: 'linear-gradient(to bottom right, oklch(55% 0.13 160), oklch(45% 0.15 160))',
              }}
            >
              อบต
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold">อบต.หัวงัว</div>
              <div className="text-xs text-muted">แจ้งเหตุ · ติดตามงานบริการ</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-8 md:flex">
            <Link
              href="/#home"
              className="text-sm font-medium transition-colors hover:text-accent"
            >
              หน้าแรก
            </Link>
            <Link
              href="/#services"
              className="text-sm font-medium transition-colors hover:text-accent"
            >
              บริการ
            </Link>
            <Link
              href="/#how-it-works"
              className="text-sm font-medium transition-colors hover:text-accent"
            >
              ขั้นตอน
            </Link>
            <Link
              href="/track"
              className="text-sm font-medium transition-colors hover:text-accent"
            >
              ติดตามงาน
            </Link>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="shadow-md"
              style={{
                background: 'linear-gradient(to right, oklch(55% 0.13 160), oklch(45% 0.15 160))',
                color: 'oklch(99% 0.005 145)',
              }}
              asChild
            >
              <Link href="/intake">
                <Bell className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">แจ้งเหตุ</span>
              </Link>
            </Button>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-surface-sunken md:hidden"
              aria-label={mobileOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          id="mobile-nav-menu"
          className="border-t bg-surface-raised md:hidden"
          role="menu"
          aria-label="เมนูหลัก (มือถือ)"
        >
          <div className="container mx-auto flex flex-col gap-1 px-4 py-4 sm:px-6">
            <MobileLink href="/intake" onClick={() => setMobileOpen(false)} icon={<Bell className="h-4 w-4" />}>
              แจ้งเหตุออนไลน์
            </MobileLink>
            <MobileLink href="/track" onClick={() => setMobileOpen(false)} icon={<Search className="h-4 w-4" />}>
              ติดตามงาน
            </MobileLink>
            <MobileLink href="/#services" onClick={() => setMobileOpen(false)}>
              บริการของเรา
            </MobileLink>
            <MobileLink href="/#how-it-works" onClick={() => setMobileOpen(false)}>
              ขั้นตอนการทำงาน
            </MobileLink>
          </div>
        </div>
      )}
    </nav>
  );
}

function MobileLink({
  href,
  onClick,
  icon,
  children,
}: {
  href: string;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      role="menuitem"
      className="flex min-h-touch items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
    >
      {icon}
      {children}
    </Link>
  );
}
