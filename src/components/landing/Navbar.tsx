'use client';

import Link from 'next/link';
import { Bell, Menu } from 'lucide-react';
import { Button } from '../ui/button';

export function Navbar() {
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
              href="#home"
              className="text-sm font-medium transition-colors hover:text-accent"
            >
              หน้าแรก
            </Link>
            <Link
              href="#services"
              className="text-sm font-medium transition-colors hover:text-accent"
            >
              บริการ
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium transition-colors hover:text-accent"
            >
              ขั้นตอน
            </Link>
            <Link
              href="#tracking"
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
              <Link href="#tracking">
                <Bell className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">แจ้งเหตุ</span>
              </Link>
            </Button>

            {/* Mobile menu button */}
            <button
              className="flex h-10 w-10 items-center justify-center rounded-lg md:hidden"
              aria-label="เปิดเมนู"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
