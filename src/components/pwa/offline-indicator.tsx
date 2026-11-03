'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

/**
 * OfflineIndicator — แสดงแถบแจ้งเตือนสถานะเมื่ออุปกรณ์หลุดจากการเชื่อมต่ออินเทอร์เน็ต
 */
'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

let isOfflineStore = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOfflineStore = false;
    notify();
  });
  window.addEventListener('offline', () => {
    isOfflineStore = true;
    notify();
  });
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  return isOfflineStore;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * OfflineIndicator — แสดงแถบแจ้งเตือนสถานะเมื่ออุปกรณ์หลุดจากการเชื่อมต่ออินเทอร์เน็ต
 */
export function OfflineIndicator() {
  const isOffline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const handleOnline = () => {
      setJustReconnected(true);
      timer = setTimeout(() => {
        setJustReconnected(false);
      }, 3500);
    };

    window.addEventListener('online', handleOnline);

    return () => {
      if (timer) clearTimeout(timer);
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
      className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold transition-all shadow-md ${
        isOffline
          ? 'bg-warning-soft text-warning-ink border-b border-warning-border'
          : 'bg-success-soft text-success-ink border-b border-success-ink/20 animate-fade-in'
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


