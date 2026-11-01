'use client';

import { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { logout } from '@/app/admin/actions';
import { useSessionTimeout } from '@/hooks/use-session-timeout';
import { Button } from '@/components/ui/button';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function SessionTimeoutWarning() {
  const { showWarning, remainingSeconds, restartIdleTimer } = useSessionTimeout(() => {
    void logout();
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // โฟกัสเข้า dialog เมื่อเปิด + คืนโฟกัสเมื่อปิด + กัก Tab
  useEffect(() => {
    if (!showWarning) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
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
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocusRef.current?.focus();
    };
  }, [showWarning]);

  if (!showWarning) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-desc"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px] motion-reduce:backdrop-blur-none print:hidden"
    >
      <div ref={dialogRef} className="w-full max-w-md rounded-lg border border-border bg-surface-raised p-6 shadow-overlay">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-warning/15">
            <AlertCircle className="h-6 w-6 text-warning" aria-hidden="true" />
          </div>
          <h2 id="session-timeout-title" className="text-lg font-semibold text-ink">
            เซสชันกำลังจะหมดอายุ
          </h2>
        </div>

        <p id="session-timeout-desc" className="mb-4 text-muted">
          เซสชันของคุณจะหมดอายุในอีก{' '}
          <span className="font-semibold tabular-nums text-danger">{formatTime(remainingSeconds)}</span> เนื่องจาก
          ไม่มีการใช้งาน — กด &quot;ใช้งานต่อ&quot; เพื่อเริ่มนับเวลาการไม่ใช้งานใหม่
        </p>

        <div className="flex gap-3">
          <Button variant="primary" className="flex-1" onClick={restartIdleTimer}>
            ใช้งานต่อ
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => void logout()}>
            ออกจากระบบ
          </Button>
        </div>
      </div>
    </div>
  );
}
