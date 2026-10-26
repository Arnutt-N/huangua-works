'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { ApiFail } from '@/app/admin/_lib/admin-api';
import { Button } from '@/components/ui/button';

/**
 * แบนเนอร์ error กลาง — ใช้แทน empty state เมื่อ `data === null && error && !loading`
 * 2 variant: `card` (default, แทน empty state) และ `inline` (banner เล็กเหนือรายการเมื่อ data !== null)
 */
export function AdminErrorState({
  error,
  errorCode,
  onRetry,
  variant = 'card',
}: {
  error: string;
  errorCode?: ApiFail['code'];
  onRetry: () => void;
  variant?: 'card' | 'inline';
}) {
  const isSessionExpired = errorCode === 'SESSION_EXPIRED';
  if (variant === 'inline') {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-danger-ink/30 bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-ink"
      >
        <AlertTriangle className="h-4 w-4 flex-none" aria-hidden="true" />
        <span className="flex-1">{error}</span>
        {isSessionExpired ? (
          <Link href="/admin/login" className="underline">
            เข้าสู่ระบบ
          </Link>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
            ลองใหม่
          </Button>
        )}
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="rounded-xl border border-dashed border-danger-ink/30 bg-danger-soft/50 p-12 text-center"
    >
      <AlertTriangle className="mx-auto h-8 w-8 text-danger" aria-hidden="true" />
      <p className="mt-2 text-sm font-semibold text-danger-ink">{error}</p>
      <div className="mt-4 flex items-center justify-center gap-2">
        {isSessionExpired ? (
          <Link
            href="/admin/login"
            className="inline-flex min-h-touch items-center gap-1.5 rounded-md border border-border bg-transparent px-4 text-sm font-semibold text-ink"
          >
            เข้าสู่ระบบใหม่
          </Link>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            ลองใหม่
          </Button>
        )}
      </div>
    </div>
  );
}
