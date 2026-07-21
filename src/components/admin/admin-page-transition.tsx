'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * AdminPageTransition — wrapper สำหรับ framer-motion entrance ของ main content
 * ใช้ทุก admin page เพื่อให้มี unity กับ landing (ที่ใช้ motion ที่ Hero/Stats)
 *
 * - fade + slide-up เล็กน้อย (12px) — เพียงพอให้รู้สึก modern แต่ไม่ noise
 * - เคารพ prefers-reduced-motion (กลายเป็น instant)
 * - ไม่ใช้ stagger ระดับ children — จะดู over-designed สำหรับ admin
 */
export function AdminPageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
