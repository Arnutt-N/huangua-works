'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiResult } from './admin-api';

/**
 * hook เดียวของหน้า admin: โหลดตอนเปิด/ค้นหา, mutate แล้วโหลดใหม่,
 * ข้อความแจ้งผล + timer, และทิ้ง response ที่มาช้า — ดู architecture-review card c3
 *
 * § ทำไม effect ต้องเป็น setTimeout + async IIFE ข้างใน: rule
 *   react-hooks/set-state-in-effect (eslint-plugin-react-hooks 7) ขึ้น error ทันที
 *   ถ้าเรียก function ที่มี setState (เช่น useCallback loader) ตรง ๆ จาก effect —
 *   แม้ setState จะอยู่หลัง await ก็ตาม (พิสูจน์แล้วด้วย `npx eslint --stdin`)
 *   จึงวาง setState ไว้ใน callback ของ timer/promise เท่านั้น ห้ามมี setState
 *   แบบ synchronous ใน body ของ effect
 * § loadingOnReload:false ใช้กับหน้า health ที่ poll อยู่ — กัน card กระพริบเป็น
 *   "กำลังตรวจสอบ..." ทุก 30 วินาที (พฤติกรรมเดิมของ health-client)
 */

export type Feedback = { type: 'success' | 'error'; msg: string } | null;

const FEEDBACK_MS = 4000;

export interface UseResourceOptions<TData> {
  /** ส่งฟังก์ชันคงที่จาก module (adminApi.xxx) — ห้ามสร้าง arrow inline ถ้าอยากให้ reload ตาม query ใหม่ */
  load: (query: string) => Promise<ApiResult<TData>>;
  query?: string;
  debounceMs?: number;
  intervalMs?: number;
  loadingOnReload?: boolean;
}

export interface UseResourceResult<TData> {
  data: TData | null;
  loading: boolean;
  feedback: Feedback;
  notify: (type: 'success' | 'error', msg: string) => void;
  clearFeedback: () => void;
  reload: () => Promise<void>;
  mutate: <TResult>(
    fn: () => Promise<ApiResult<TResult>>,
    successMsg: string,
    mutateOpts?: { reload?: boolean },
  ) => Promise<boolean>;
  setData: (updater: (prev: TData | null) => TData | null) => void;
}

export function useResource<TData>(options: UseResourceOptions<TData>): UseResourceResult<TData> {
  const {
    load,
    query = '',
    debounceMs = 0,
    intervalMs,
    loadingOnReload = true,
  } = options;

  const [data, setDataState] = useState<TData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const seqRef = useRef(0); // เก็บลำดับ request ล่าสุด — response เก่าที่มาช้าคนละ seq จะถูกทิ้ง
  const mountedRef = useRef(true); // false หลัง unmount — กัน notify/setState จาก reload ที่ค้าง
  const firstRef = useRef(true); // mount ต้องโหลดทันที ไม่รอ debounce
  const notifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRef = useRef(load);

  // ให้ handler/reload เรียก load ล่าสุดเสมอ โดยไม่ทำให้ effect รันซ้ำ
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const clearFeedback = useCallback(() => {
    if (notifyTimerRef.current !== null) {
      clearTimeout(notifyTimerRef.current);
      notifyTimerRef.current = null;
    }
    setFeedback(null);
  }, []);

  const notify = useCallback((type: 'success' | 'error', msg: string) => {
    // เคลียร์ timer เก่าก่อนเสมอ — ไม่งั้นข้อความใหม่จะโดน timer ของข้อความเก่าลบ
    if (notifyTimerRef.current !== null) clearTimeout(notifyTimerRef.current);
    setFeedback({ type, msg });
    notifyTimerRef.current = setTimeout(() => {
      notifyTimerRef.current = null;
      setFeedback(null);
    }, FEEDBACK_MS);
  }, []);

  // ปลด timer แจ้งผลตอน unmount + ยกเลิก seq ของ reload ที่ค้าง (manual reload ไม่ได้อยู่ใน effect)
  // § setup ต้องชุบ mounted กลับเป็น true เสมอ — StrictMode จำลอง unmount→remount ตอน mount
  // ถ้า setup ทำแค่ return cleanup ค่า false จาก cleanup จำลองจะค้างถาวร แล้ว load/reload
  // ทุกครั้ง early-return ที่ !mountedRef (ค้าง loading ทั้งที่ API ตอบ 200)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      seqRef.current += 1;
      if (notifyTimerRef.current !== null) clearTimeout(notifyTimerRef.current);
    };
  }, []);

  const reload = useCallback(async () => {
    const seq = ++seqRef.current;
    if (loadingOnReload) setLoading(true);
    const res = await loadRef.current(query);
    // § generation + mounted: effect cleanup ตั้ง cancelled เฉพาะ run ของ effect
    // manual reload ที่ค้างต้องถูกทิ้งด้วย seq เดียวกัน และห้าม notify/ตั้ง timer หลัง unmount
    if (!mountedRef.current || seq !== seqRef.current) return;
    if (res.ok) setDataState(res.data);
    else notify('error', res.error);
    setLoading(false);
  }, [query, loadingOnReload, notify]);

  const mutate = useCallback(
    async <TResult,>(
      fn: () => Promise<ApiResult<TResult>>,
      successMsg: string,
      mutateOpts?: { reload?: boolean },
    ): Promise<boolean> => {
      const res = await fn();
      if (!res.ok) {
        notify('error', res.error);
        return false;
      }
      notify('success', successMsg);
      if (mutateOpts?.reload !== false) await reload();
      return true;
    },
    [notify, reload],
  );

  const setData = useCallback((updater: (prev: TData | null) => TData | null) => {
    setDataState((prev) => updater(prev));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (loadingOnReload) setLoading(true);
      const seq = ++seqRef.current;
      void (async () => {
        const res = await loadRef.current(query);
        if (!mountedRef.current || cancelled || seq !== seqRef.current) return;
        if (res.ok) setDataState(res.data);
        else notify('error', res.error);
        setLoading(false);
      })();
    };
    // mount โหลดทันที (delay 0) — ไม่งั้นหน้า list จะค้าง 300ms ตอนเปิด
    const delay = firstRef.current ? 0 : debounceMs;
    firstRef.current = false;
    const timer = setTimeout(run, delay);
    const poll = intervalMs ? setInterval(run, intervalMs) : null;
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (poll !== null) clearInterval(poll);
    };
  }, [query, debounceMs, intervalMs, loadingOnReload, notify]);

  return { data, loading, feedback, notify, clearFeedback, reload, mutate, setData };
}
