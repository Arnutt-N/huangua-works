'use client';

import { useEffect } from 'react';

/**
 * PwaRegister — ลงทะเบียน Service Worker (/sw.js) ในเบราว์เซอร์ที่รองรับ
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // ลงทะเบียน Service Worker หลังหน้าเว็บโหลดเสร็จสมบูรณ์
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // ตรวจสอบการอัปเดต Service Worker เมื่อมีการเปลี่ยนแปลง
          registration.onupdatefound = () => {
            const installing = registration.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  // มีเวอร์ชันใหม่พร้อมใช้งาน
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[PWA] service worker registration failed', err);
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
