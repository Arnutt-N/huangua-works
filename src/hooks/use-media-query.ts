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

/**
 * SSR-safe media query hook — initial `false` กัน hydration mismatch
 * (server ไม่มี matchMedia → render mobile ก่อน, hydrate แล้วค่อยแก้เป็น desktop)
 */
export function useMediaQuery(query: string = QUERY): boolean {
  void query;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
