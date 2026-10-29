'use client';

import { useEffect, useState } from 'react';

/**
 * § โหลด presigned URL ของไฟล์เดียวจาก read-url endpoint
 * URL อายุ 5 นาที จึงโหลดตอน item ถูก mount ไม่ใช่ฝังมากับรายการ
 * คืน null ระหว่างโหลด/ล้มเหลว — caller แสดง placeholder เอง
 */
export function useMediaItemReadUrl(mediaId: string, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/line/admin/media/${mediaId}/read-url`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { url?: unknown };
        if (cancelled || typeof data.url !== 'string') return;
        setUrl(data.url);
      } catch {
        // § เงียบไว้ — placeholder ของ caller แสดงสถานะ "ยังไม่มีรูป" อยู่แล้ว
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaId, enabled]);

  return url;
}
