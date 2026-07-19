import Link from 'next/link';

/**
 * SiteHeader — top bar ใช้ร่วมทุกหน้า (server component, ไม่ 'use client')
 * wordmark 2 บรรทัด + nav 3 ลิงก์ (แจ้งเรื่อง / ติดตาม / เข้าระบบเจ้าหน้าที่)
 * touch >=44px ทุกลิงก์, hairline ล่าง, surface พื้น (DESIGN.md §5 Navigation)
 */
export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex min-h-touch w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-block h-7 w-7 rounded-md bg-accent-strong"
          />
          <span className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">อบต.หัวงัว</span>
            <span className="mt-0.5 text-xs text-muted">แจ้งเหตุ · ติดตามงานบริการ</span>
          </span>
        </Link>
        <nav aria-label="เมนูหลัก" className="flex items-center gap-1 text-sm sm:gap-2">
          <Link
            href="/intake"
            className="inline-flex min-h-touch items-center rounded-md px-3 text-ink/80 hover:bg-accent-sunken hover:text-ink"
          >
            แจ้งเรื่อง
          </Link>
          <Link
            href="/track"
            className="inline-flex min-h-touch items-center rounded-md px-3 text-ink/80 hover:bg-accent-sunken hover:text-ink"
          >
            ติดตาม
          </Link>
          <Link
            href="/admin/login"
            className="inline-flex min-h-touch items-center rounded-md px-3 text-ink/80 hover:bg-accent-sunken hover:text-ink"
          >
            <span className="hidden sm:inline">เข้าระบบเจ้าหน้าที่</span>
            <span className="sm:hidden">เข้าระบบ</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}