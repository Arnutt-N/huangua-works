'use client';

import { useSyncExternalStore } from 'react';

/**
 * ตรงกับ breakpoint `md` ของ Tailwind (48rem = 768px)
 *
 * § ต้องเป็นค่าเดียวกับคลาส `md:` ใน AdminLayout
 * ปุ่มเปิดเมนูใช้ `md:hidden` และ sidebar ใช้ `md:translate-x-0`
 * ถ้า query นี้กว้างกว่าคลาส CSS แถบเมนูจะโผล่แต่ถูกใส่ inert กดไม่ได้
 * ถ้า query นี้แคบกว่าคลาส CSS แถบเมนูจะถูกเลื่อนออกจอทั้งที่ปุ่มเปิดเมนูถูกซ่อน
 */
export const ADMIN_SIDEBAR_QUERY = '(min-width: 768px)';

const QUERY = ADMIN_SIDEBAR_QUERY;

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export interface MediaQueryResult {
  /** ค่าจริงของ media query — false ตอน SSR (ยังไม่รู้) */
  isDesktop: boolean;
  /** true หลัง hydrate เสร็จแล้ว — ใช้แยก "ยังไม่รู้" (SSR) จาก "รู้แล้วว่าเป็น mobile" */
  hydrated: boolean;
}

/** hydrated flag: false ตอน SSR/ก่อน hydrate, true หลัง hydrate (ไม่ subscribe อะไร) */
function subscribeNoop(): () => void {
  return () => {};
}

/**
 * SSR-safe media query hook — initial `false` กัน hydration mismatch
 * (server ไม่มี matchMedia → render mobile ก่อน, hydrate แล้วค่อยแก้เป็น desktop)
 *
 * § `hydrated` แยกออกมาเพราะ attribute อย่าง `inert` ต้องไม่ถูกใส่ตอน SSR:
 * ถ้าใส่ inert ใน HTML แรก ผู้ใช้ desktop จะกดเมนูไม่ได้จนกว่า JS จะ hydrate เสร็จ
 * (และถ้า JS ล้ม ผู้ใช้ desktop ใช้ sidebar ไม่ได้เลยตลอด session)
 */
export function useMediaQuery(): MediaQueryResult {
  const isDesktop = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  return { isDesktop, hydrated };
}
