'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

/**
 * OfflineIndicator — แสดงแถบแจ้งเตือนสถานะเมื่ออุปกรณ์หลุดจากการเชื่อมต่ออินเทอร์เน็ต
 */
export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return !navigator.onLine;
    }
    return false;
  });
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const handleOffline = () => {
      setIsOffline(true);
      setJustReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setJustReconnected(true);
      timer = setTimeout(() => {
        setJustReconnected(false);
      }, 3500);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !justReconnected) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium transition-all shadow-md ${
        isOffline
          ? 'bg-amber-600 text-white'
          : 'bg-emerald-600 text-white animate-fade-in'
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>คุณกำลังอยู่ในโหมดออฟไลน์ (ไม่มีสัญญาณอินเทอร์เน็ต)</span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>เชื่อมต่ออินเทอร์เน็ตเรียบร้อยแล้ว</span>
        </>
      )}
    </div>
  );
}


