'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * error boundary ระดับ admin — ข้อความไทย + ปุ่มลองใหม่ + กลับแดชบอร์ด
 * ต้องเป็น client component (Next 16 error boundary) — มี 'use client' ข้างบน
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (typeof console !== 'undefined') console.error('[admin] error boundary', error);
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
      <h2 className="text-lg font-bold text-ink">เกิดข้อผิดพลาด</h2>
      <p className="mt-2 text-sm text-muted">ขออภัย เกิดข้อผิดพลาดขณะโหลดหน้านี้ กรุณาลองใหม่หรือกลับแดชบอร์ด</p>
      {error.digest && <p className="mt-1 font-mono text-xs text-muted">รหัส: {error.digest}</p>}
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button type="button" onClick={reset}>
          ลองใหม่
        </Button>
        <Link
          href="/admin"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-md border border-border bg-transparent px-4 text-sm font-semibold text-ink"
        >
          กลับแดชบอร์ด
        </Link>
      </div>
    </div>
  );
}
