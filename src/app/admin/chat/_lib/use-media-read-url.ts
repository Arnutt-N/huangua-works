'use client';

import { useEffect, useState } from 'react';

/**
 * § โหลด presigned URL เมื่อถึงเวลาจะแสดงรูปจริง — URL อายุ 5 นาที จึงห้าม cache
 * ข้ามรอบ render นาน ๆ และห้ามฝัง URL ลง state ที่ hydrate จาก server
 *
 * คืน null ระหว่างโหลด/ล้มเหลว — caller แสดง placeholder ของตัวเอง
 * cancelled guard: setState หลัง unmount ไม่เกิด (React 18 ไม่ warn แต่ leaks memory)
 */
export function useMediaReadUrl(endpoint: string | null): {
  url: string | null;
  loading: boolean;
  failed: boolean;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!endpoint) {
      // § setState ใน setTimeout ตาม Convention ของ use-resource.ts —
      // rule react-hooks/set-state-in-effect ห้าม setState synchronous ใน effect body
      const t = setTimeout(() => {
        setUrl(null);
        setLoading(false);
        setFailed(false);
      }, 0);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      setFailed(false);
    }, 0);

    void (async () => {
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { url?: unknown };
        if (cancelled) return;
        if (typeof data.url !== 'string') throw new Error('malformed');
        setUrl(data.url);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setUrl(null);
        setLoading(false);
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [endpoint]);

  return { url, loading, failed };
}
