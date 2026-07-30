'use client';

import { useEffect, useRef, useState } from 'react';
import { searchMessages } from '../_lib/api';
import type { MessageSearchResult } from '../_lib/types';

/** ค้นหาข้อความฝั่ง server — debounce 300ms + กันผลลัพธ์เก่าทับใหม่ (stale response) */
export function useMessageSearch(query: string) {
  const [results, setResults] = useState<MessageSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const requestSeq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    /* eslint-disable react-hooks/set-state-in-effect -- debounce ต้อง sync สถานะ searching กับ query ทันที */
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      const items = await searchMessages(q);
      if (seq !== requestSeq.current) return;
      setResults(items);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return { results, searching };
}
