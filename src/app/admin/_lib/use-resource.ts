'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiFail, ApiResult } from './admin-api';

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
  load: (query: string, opts?: { signal?: AbortSignal }) => Promise<ApiResult<TData>>;
  query?: string;
  debounceMs?: number;
  intervalMs?: number;
  loadingOnReload?: boolean;
}

export interface UseResourceResult<TData> {
  data: TData | null;
  loading: boolean;
  feedback: Feedback;
  /** persistent error จาก load — คงค้างจนกว่า request ถัดไปสำเร็จ (แยกจาก feedback ที่ auto-clear) */
  error: string | null;
  /** code คู่กับ error — AdminErrorState ใช้ branch SESSION_EXPIRED → ลิงก์ login */
  errorCode?: ApiFail['code'];
  /** HTTP status ของ load fail — detail pages ใช้แยก 404 (notFound) ออกจาก error อื่น */
  errorStatus?: number;
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
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ApiFail['code']>(undefined);
  const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined);

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

  const notify = useCallback(
    (type: 'success' | 'error', msg: string, meta?: { code?: ApiFail['code']; status?: number }) => {
      // เคลียร์ timer เก่าก่อนเสมอ — ไม่งั้นข้อความใหม่จะโดน timer ของข้อความเก่าลบ
      if (notifyTimerRef.current !== null) clearTimeout(notifyTimerRef.current);
      setFeedback({ type, msg });
      if (type === 'success') {
        // § success auto-clear ตามเดิม — แต่ error ต้องคงค้าง (NET-02: ไม่หายเองก่อนผู้ใช้แก้)
        notifyTimerRef.current = setTimeout(() => {
          notifyTimerRef.current = null;
          setFeedback(null);
        }, FEEDBACK_MS);
      } else {
        // § error ต้องแสดงคู่กับ code/status ของ "ครั้งที่ error เกิด" เสมอ — ถ้าไม่ส่ง meta มา
        // (mutation error ที่ server ไม่ให้ code) ต้องเคลียร์ของเก่า ไม่งั้น SESSION_EXPIRED
        // จาก load ก่อนหน้าจะค้างและ AdminErrorState โชว์ "เข้าสู่ระบบใหม่" ผิดสาเหตุ
        setError(msg);
        setErrorCode(meta?.code);
        setErrorStatus(meta?.status);
      }
    },
    [],
  );

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

  const applyLoadResult = useCallback(
    (res: ApiResult<TData>) => {
      if (res.ok) {
        setDataState(res.data);
        setError(null);
        setErrorCode(undefined);
        setErrorStatus(undefined);
      } else {
        // § persistent error — คงค้างจนกว่า request ถัดไปสำเร็จ (feedback ยัง auto-clear ตามเดิมสำหรับ success)
        // ส่ง code/status ผ่าน notify เพื่อให้ error กับ code มาจากครั้งเดียวกันเสมอ
        notify('error', res.error, { code: res.code, status: res.status });
      }
    },
    [notify],
  );

  const reload = useCallback(async () => {
    const seq = ++seqRef.current;
    if (loadingOnReload) setLoading(true);
    const ctrl = new AbortController();
    let res: ApiResult<TData>;
    try {
      res = await loadRef.current(query, { signal: ctrl.signal });
    } catch (err) {
      // § caller abort (unmount/query เปลี่ยน) → ทิ้งเงียบ ไม่ตั้ง error
      if (err instanceof DOMException && err.name === 'AbortError') return;
      throw err;
    }
    // § generation + mounted: effect cleanup ตั้ง cancelled เฉพาะ run ของ effect
    // manual reload ที่ค้างต้องถูกทิ้งด้วย seq เดียวกัน และห้าม notify/ตั้ง timer หลัง unmount
    if (!mountedRef.current || seq !== seqRef.current) return;
    applyLoadResult(res);
    setLoading(false);
  }, [query, loadingOnReload, notify, applyLoadResult]);

  // § in-flight guard: กันเรียก mutate() ซ้อนกันในตัว hook เอง (ถ้า in-flight อยู่ return false ทันที)
  const mutateInFlightRef = useRef(false);
  const mutate = useCallback(
    async <TResult,>(
      fn: () => Promise<ApiResult<TResult>>,
      successMsg: string,
      mutateOpts?: { reload?: boolean },
    ): Promise<boolean> => {
      if (mutateInFlightRef.current) return false;
      mutateInFlightRef.current = true;
      try {
        const res = await fn();
        if (!res.ok) {
          notify('error', res.error);
          return false;
        }
        notify('success', successMsg);
        // § mutation สำเร็จ = ผู้ใช้แก้ปัญหาที่ทำให้ error ค้างแล้ว → เคลียร์ persistent error
        // (กรณี reload:false จะไม่มี load มาล้างให้ ไม่งั้น error เก่าค้างตลอดไป)
        setError(null);
        setErrorCode(undefined);
        setErrorStatus(undefined);
        if (mutateOpts?.reload !== false) await reload();
        return true;
      } finally {
        mutateInFlightRef.current = false;
      }
    },
    [notify, reload],
  );

  const setData = useCallback((updater: (prev: TData | null) => TData | null) => {
    setDataState((prev) => updater(prev));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const run = () => {
      if (loadingOnReload) setLoading(true);
      const seq = ++seqRef.current;
      void (async () => {
        let res: ApiResult<TData>;
        try {
          res = await loadRef.current(query, { signal: ctrl.signal });
        } catch (err) {
          // § abort จาก cleanup (unmount/query เปลี่ยน) → ทิ้งเงียบ ไม่ตั้ง error
          if (err instanceof DOMException && err.name === 'AbortError') return;
          throw err;
        }
        if (!mountedRef.current || cancelled || seq !== seqRef.current) return;
        applyLoadResult(res);
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
      ctrl.abort();
      clearTimeout(timer);
      if (poll !== null) clearInterval(poll);
    };
  }, [query, debounceMs, intervalMs, loadingOnReload, notify, applyLoadResult]);

  return { data, loading, feedback, error, errorCode, errorStatus, notify, clearFeedback, reload, mutate, setData };
}
