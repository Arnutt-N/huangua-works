'use client';

import { AlertCircle } from 'lucide-react';
import { logout } from '@/app/admin/actions';
import { useSessionTimeout } from '@/hooks/use-session-timeout';
import { Button } from '@/components/ui/button';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * SessionTimeoutWarning — modal เตือนเซสชันใกล้หมดจาก inactivity
 *
 * § ยกแบบมาจาก jsk SessionTimeoutWarning.tsx เปลี่ยน logout เป็น server action
 * ของหัวงัว (ซึ่งล้าง cookie แล้ว redirect) ส่วน "Stay Logged In" ต่อแค่ตัวเตือน
 * ตามที่ § ใน use-session-timeout กำกับ — ไม่แตะอายุ JWT
 */
export function SessionTimeoutWarning() {
  const { showWarning, remainingSeconds, extendSession } = useSessionTimeout(() => {
    void logout();
  });

  if (!showWarning) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px] motion-reduce:backdrop-blur-none"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-surface-raised p-6 shadow-overlay">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-warning/15">
            <AlertCircle className="h-6 w-6 text-warning" aria-hidden="true" />
          </div>
          <h2 id="session-timeout-title" className="text-lg font-semibold text-ink">
            Session Expiring Soon
          </h2>
        </div>

        <p className="mb-4 text-muted">
          Your session will expire in{' '}
          <span className="font-semibold tabular-nums text-danger">{formatTime(remainingSeconds)}</span> due to
          inactivity. Click below to stay logged in.
        </p>

        <div className="flex gap-3">
          <Button variant="primary" className="flex-1" onClick={extendSession}>
            Stay Logged In
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => void logout()}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
