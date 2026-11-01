'use client';

import { Printer } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PrintButtonProps {
  label?: string;
  className?: string;
}

/**
 * PrintButton — ปุ่มสั่งพิมพ์เอกสารสำหรับหน้าแอดมินและรายงานสรุป
 *
 * § ความปลอดภัยและการทำงาน:
 * - ทำงานฝั่ง client เท่านั้น ('use client')
 * - ตรวจสอบ typeof window !== 'undefined' ก่อนเรียก window.print()
 * - ได้มาตรฐานการเข้าถึง (a11y): min-h-touch >= 44px, focus-visible ring
 * - ซ่อนตัวเองอัตโนมัติในโหมดพิมพ์ (print:hidden)
 */
export function PrintButton({
  label = 'พิมพ์รายงาน',
  className,
}: PrintButtonProps) {
  function handlePrint() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      className={cn(
        'inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink shadow-xs transition-colors hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong print:hidden',
        className,
      )}
      aria-label={label}
    >
      <Printer className="h-4 w-4 text-muted" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
