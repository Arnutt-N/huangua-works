import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Pagination — นำทางหน้าสำหรับ list views
 *
 * แสดงปุ่ม ก่อนหน้า/ถัดไป + เลขหน้า (กระชับ)
 * สำหรับ admin ที่ใช้ URL search params (server-side pagination)
 *
 * @param currentPage - หน้าปัจจุบัน (1-indexed)
 * @param totalPages - จำนวนหน้าทั้งหมด
 * @param basePath - base path เช่น '/admin' หรือ '/admin/audit'
 * @param searchParams - search params ปัจจุบัน (เพื่อ preserve filter ตอนเปลี่ยนหน้า)
 */
export function Pagination({
  currentPage,
  totalPages,
  basePath,
  searchParams,
}: {
  currentPage: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (totalPages <= 1) return null;

  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    if (searchParams) {
      for (const [key, value] of Object.entries(searchParams)) {
        if (key === 'page' || value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) params.append(key, v);
        } else {
          params.set(key, value);
        }
      }
    }
    params.set('page', String(page));
    return `${basePath}?${params.toString()}`;
  };

  // คำนวณช่วงเลขหน้าที่แสดง (ปัจจุบัน ± 2, อย่างน้อย 1, มากสุด totalPages)
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav
      className="mt-6 flex items-center justify-center gap-1"
      aria-label="การแบ่งหน้า"
    >
      <PageLink
        href={buildHref(currentPage - 1)}
        disabled={currentPage <= 1}
        ariaLabel="หน้าก่อนหน้า"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </PageLink>

      {start > 1 && (
        <>
          <PageLink href={buildHref(1)}>1</PageLink>
          {start > 2 && <span className="px-2 text-muted">…</span>}
        </>
      )}

      {pages.map((page) => (
        <PageLink
          key={page}
          href={buildHref(page)}
          active={page === currentPage}
        >
          {page}
        </PageLink>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-2 text-muted">…</span>}
          <PageLink href={buildHref(totalPages)}>{totalPages}</PageLink>
        </>
      )}

      <PageLink
        href={buildHref(currentPage + 1)}
        disabled={currentPage >= totalPages}
        ariaLabel="หน้าถัดไป"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  children,
  active = false,
  disabled = false,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        aria-label={ariaLabel}
        className={cn(
          'flex min-h-touch min-w-touch items-center justify-center rounded-md px-3 text-sm',
          active
            ? 'bg-accent-strong text-on-accent'
            : 'cursor-not-allowed text-muted opacity-50',
        )}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-touch min-w-touch items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors duration-normal ease-out-expo',
        active
          ? 'bg-accent-strong text-on-accent'
          : 'border border-border bg-surface-raised text-ink hover:bg-accent-sunken',
      )}
    >
      {children}
    </Link>
  );
}
