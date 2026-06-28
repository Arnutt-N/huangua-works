'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Reveal (DESIGN.md §motion: restrained)
 * - fade + translate ขึ้นตอนเข้า viewport ครั้งเดียว (state change = อนุญาต)
 * - ใช้ IntersectionObserver, disconnect หลังโผล่ (ไม่ re-trigger)
 * - reduced-motion: โผล่ทันที ไม่มี transform (Elderly Floor + a11y)
 * - delay (ms) สำหรับ stagger ภายในกลุ่ม
 */
export interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || typeof IntersectionObserver === 'undefined') {
      // defer เพื่อหลีก synchronous setState ใน effect body (react-hooks rule)
      // motion-reduce:transition-none ทำให้ข้ามสถานะทันที ไม่มี flash
      const id = window.setTimeout(() => setShown(true), 0);
      return () => window.clearTimeout(id);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        'transition-all duration-700 ease-out-expo motion-reduce:transition-none',
        shown
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 motion-reduce:opacity-100 motion-reduce:translate-y-0',
        className,
      )}
    >
      {children}
    </div>
  );
}