'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getLiffId } from '@/lib/liff/config';
import { loadLiffSdk } from './liff-sdk';

/**
 * LiffProvider — โหลด LIFF SDK ผ่าน CDN (ไม่เพิ่ม npm dep ตามแผนเดิมใน
 * docs/implementation-plan.md PR #7)
 *
 * 3 สถานะหลัก:
 * - disabled: ไม่มี NEXT_PUBLIC_LIFF_ID (หรือยังไม่ใส่ค่า) → หน้าเว็บทำงานแบบเดิม 100%
 * - ready: init สำเร็จ — ถ้าอยู่ใน LINE (isInClient) จะแลก ID token เป็น session
 *   cookie กับ /api/liff/session ให้อัตโนมัติ (ครั้งเดียว หลังจากนั้นใช้ cookie ต่ออายุ)
 * - error: SDK โหลด/init พัง → fallback เป็นเว็บธรรมดาเหมือน disabled
 *
 * § ในเบราว์เซอร์ปกติ (ไม่ใช่ LINE in-app) จะไม่ยิง liff.login() อัตโนมัติ —
 * PRD กำหนดว่าเปิด /intake จากเบราว์เซอร์ต้องได้ฟอร์มเดิม (CID บังคับ) การ redirect
 * ไป LINE login กลางคันจะทำให้ลิงก์ที่แชร์ออกไปใช้ไม่ได้ทันที
 */

type LiffStatus = 'disabled' | 'loading' | 'ready' | 'error';
export interface LiffContextValue {
  status: LiffStatus;
  /** อยู่ในหน้าต่าง LINE (LIFF browser) หรือเบราว์เซอร์ปกติ */
  isInClient: boolean;
  /**
   * ยืนยันตัวกับระบบสำเร็จ (server verify LINE ID token แล้ว มี session cookie)
   * — แค่ init LIFF ผ่านไม่พอ ต้องผ่าน /api/liff/session ถึงจะถือว่าเชื่อถือได้
   */
  authenticated: boolean;
  displayName: string | null;
  logout: () => Promise<void>;
}

const LiffContext = createContext<LiffContextValue>({
  status: 'disabled',
  isInClient: false,
  authenticated: false,
  displayName: null,
  logout: async () => {},
});

export function useLiff(): LiffContextValue {
  return useContext(LiffContext);
}

/** เฉพาะ e2e — § ดูคอมเมนต์ใน ensureMockSession */
function mockParam(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('liffmock');
}

/**
 * § e2e mock: query param ?liffmock=<lineUserId> เพียงทำให้ *client* ส่ง mock token
 * ไปที่ /api/liff/session — ด่านจริงอยู่ที่ server ซึ่งยอมรับ mock token เฉพาะเมื่อ
 * env LIFF_E2E_MOCK=1 เท่านั้น ผู้ใช้จริงใส่ param นี้เองก็ได้แค่ 401 จาก server
 * (จึงไม่ใช่ช่องปลอมตัว ตามข้อห้าม query-param mock ใน PRP §1.4)
 */
async function ensureMockSession(userId: string): Promise<{ authenticated: boolean; displayName: string | null }> {
  try {
    const check = await fetch('/api/liff/session');
    if (check.ok && (await check.json()).authenticated === true) {
      return { authenticated: true, displayName: userId };
    }
    const res = await fetch('/api/liff/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: `mock.${userId}` }),
    });
    return { authenticated: res.ok, displayName: userId };
  } catch {
    return { authenticated: false, displayName: null };
  }
}

async function ensureSession(): Promise<{ authenticated: boolean; displayName: string | null }> {
  const sdk = window.liff;
  if (!sdk) return { authenticated: false, displayName: null };

  try {
    const check = await fetch('/api/liff/session');
    if (check.ok && (await check.json()).authenticated === true) {
      const profile = await sdk.getProfile().catch(() => null);
      return { authenticated: true, displayName: profile?.displayName ?? null };
    }
  } catch {
    // GET พัง (offline ชั่วคราว) — ลอง POST ต่อได้
  }

  const idToken = sdk.getIDToken();
  if (!idToken) return { authenticated: false, displayName: null };

  try {
    const res = await fetch('/api/liff/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return { authenticated: false, displayName: null };
    const data = (await res.json()) as { displayName?: string | null };
    return { authenticated: true, displayName: data.displayName ?? null };
  } catch {
    return { authenticated: false, displayName: null };
  }
}

export function LiffProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<LiffStatus>('loading');
  const [isInClient, setIsInClient] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  // § กัน refresh ซ้ำ — สนใจเฉพาะ transition false→true ครั้งแรก
  const refreshedOnAuth = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // e2e: ข้าม SDK ทั้งหมด — server env LIFF_E2E_MOCK=1 เป็นตัวตัดสินจริง
      const mock = mockParam();
      if (mock) {
        const result = await ensureMockSession(mock);
        if (cancelled) return;
        setStatus('ready');
        setIsInClient(true);
        setAuthenticated(result.authenticated);
        setDisplayName(result.displayName);
        return;
      }

      const liffId = getLiffId();
      if (!liffId) {
        setStatus('disabled');
        return;
      }

      try {
        await loadLiffSdk();
        const sdk = window.liff;
        if (!sdk) throw new Error('LIFF SDK missing');
        await sdk.init({ liffId });
        if (cancelled) return;
        const inClient = sdk.isInClient();
        setIsInClient(inClient);
        setStatus('ready');
        if (inClient) {
          const result = await ensureSession();
          if (cancelled) return;
          setAuthenticated(result.authenticated);
          setDisplayName(result.displayName);
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/liff/session', { method: 'DELETE' }).catch(() => {});
    setAuthenticated(false);
    setDisplayName(null);
  }, []);

  // § เมื่อเพิ่งได้ session (cookie ถูก set ระหว่างที่หน้า render ไปแล้ว) ให้ refresh
  // หนึ่งครั้งเพื่อให้ server components เห็น cookie — จำเป็นตอนเข้า LIFF ตรงที่
  // /track จาก rich menu (server อ่าน cookie ตอน render ครั้งแรกยังไม่มี session)
  // router.refresh ไม่ทำ state ฝั่ง client หาย
  useEffect(() => {
    if (authenticated && !refreshedOnAuth.current) {
      refreshedOnAuth.current = true;
      router.refresh();
    }
  }, [authenticated, router]);

  const value = useMemo<LiffContextValue>(
    () => ({ status, isInClient, authenticated, displayName, logout }),
    [status, isInClient, authenticated, displayName, logout],
  );

  return <LiffContext.Provider value={value}>{children}</LiffContext.Provider>;
}
