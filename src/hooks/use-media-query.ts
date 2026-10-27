'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 1024px)';

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
