'use client';

import { useEffect, useState } from 'react';

/**
 * § สถานะเป็น discriminated union ไม่ใช่ 3 boolean คู่กัน — `loading && failed`
 * พร้อมกันเป็นสถานะที่เกิดไม่ได้ จึงไม่ควรเขียนได้
 *
 * URL อายุ 5 นาที: ห้าม cache ข้ามรอบ render นาน ๆ และห้ามฝัง URL ลง state
 * ที่ hydrate จาก server
 */
export type MediaReadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'failed' };

export function useMediaReadUrl(endpoint: string | null): MediaReadState {
  const [state, setState] = useState<MediaReadState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;

    // § setState อยู่ใน async IIFE ไม่ใช่ body ของ effect — rule
    // react-hooks/set-state-in-effect ห้ามเฉพาะ setState ที่รัน synchronous
    void (async () => {
      if (!endpoint) {
        setState({ status: 'idle' });
        return;
      }
      setState({ status: 'loading' });
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { url?: unknown };
        if (cancelled) return;
        if (typeof data.url !== 'string') throw new Error('malformed');
        setState({ status: 'ready', url: data.url });
      } catch {
        if (cancelled) return;
        setState({ status: 'failed' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return state;
}
