'use client';

import { useEffect, useState } from 'react';

export interface UseInViewOptions {
  rootMargin?: string;
  threshold?: number | number[];
}

/**
 * § useInView — ตรวจจับการเลื่อนเข้าสู่ Viewport ด้วย IntersectionObserver
 * - ทันทีที่เข้าสู่ viewport (isIntersecting = true) จะล็อกสถานะเป็น true และยกเลิกการ observe ทันที (disconnect)
 * - ออกแบบให้มี Graceful Fallback: หากเบราว์เซอร์หรือ test runner ไม่มี IntersectionObserver ให้ default เป็น true ทันที
 *   เพื่อให้การทำงานและ unit tests ทั่วไปยังคงทำงานได้ตามปกติโดยไม่ต้อง mock ทุกครั้ง
 */
export function useInView(
  ref: React.RefObject<HTMLElement | null>,
  options: UseInViewOptions = { rootMargin: '200px' },
): boolean {
  const [inView, setInView] = useState(() => {
    return typeof IntersectionObserver === 'undefined';
  });

  const rootMargin = options.rootMargin;
  const threshold = options.threshold;

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    if (inView) return; // เมื่อเข้า Viewport แล้ว ไม่ต้อง observe ซ้ำ

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, inView, rootMargin, threshold]);

  return inView;
}
