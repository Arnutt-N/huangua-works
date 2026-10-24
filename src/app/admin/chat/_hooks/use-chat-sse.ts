'use client';

import { useEffect, useRef, useState } from 'react';
import type { SseChatEvent } from '../_lib/types';

/**
 * SSE = invalidation hint — เชื่อมต่อครั้งเดียวตลอดอายุหน้า
 * callbacks เก็บใน ref เพื่อไม่ให้ EventSource ถูกสร้างใหม่ทุกครั้งที่ state เปลี่ยน
 * (ของเดิม reconnect ทุกครั้งที่เปลี่ยนห้อง — เสีย backlog และกระพริบ)
 *
 * § connected ใช้แสดง badge "Connected" ใน console bar — EventSource reconnect
 * เองเมื่อหลุด จึงอัปเดตจาก onopen/onerror เท่านั้น ไม่ต้อง retry เอง
 */
export function useChatSse(handlers: {
  onOpen: () => void;
  onEvent: (event: SseChatEvent) => void;
}): { connected: boolean } {
  const handlersRef = useRef(handlers);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const es = new EventSource('/api/line/admin/sse');

    // reconnect แล้ว refetch เก็บ event ที่พลาดระหว่างหลุด
    es.onopen = () => {
      setConnected(true);
      handlersRef.current.onOpen();
    };
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      let event: SseChatEvent;
      try {
        event = JSON.parse(e.data);
      } catch {
        return;
      }
      if (event.type === 'connected') return;
      handlersRef.current.onEvent(event);
    };

    return () => es.close();
  }, []);

  return { connected };
}
