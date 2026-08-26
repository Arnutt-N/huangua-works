'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { BrandMark } from '../site/brand-mark';
import { getLiffId } from '@/lib/liff/config';
import { loadLiffSdk } from './liff-sdk';

/**
 * § จุดเข้า LIFF ที่มี path (เช่น liff.line.me/<id>/track) จะโดน LINE redirect
 * มาที่หน้าแรก (Endpoint URL = root) ก่อนเสมอ โดยแพ็ค path จริงไว้ใน query
 * `liff.state` — หน้าแรกไม่ได้ mount LiffProvider จึงต้องมีตัวพาไปหน้าจริงเอง
 *
 * § ต้องรอ liff.init() เสร็จก่อนเปลี่ยน URL — เป็นข้อกำหนดตรง ๆ ของ LIFF
 * ("Process URL changes after liff.init() completes" และต้อง init ที่
 * primary redirect URL อย่างน้อยหนึ่งครั้ง) เพราะ landing URL ที่ LINE ส่งมา
 * มี credential ของ SDK อยู่ใน URL ด้วย และจะถูก consume/ล้างตอน init resolve
 * เท่านั้น ถ้า replace ก่อน init แล้วหน้าปลายทางจะ init แบบไม่มี token →
 * SDK วน auto-login กลับมา landing ซ้ำ = ลูปไม่รู้จบ (บั๊กหลัง T0, PR #68)
 *
 * § Splash แทนการโชว์หน้าแรกเต็ม ๆ (รายงาน UX 15/8/2569): ช่วง load SDK +
 * init อาจนาน ~1 วิ บนมือถือ — เดิมผู้ใช้เห็น landing เต็มหน้าแล้วเด้งหาย
 * ทำเป็น 2 ชั้น:
 *   1) pre-paint inline script ตั้ง html[data-liff-boot] ก่อนเบราว์เซอร์
 *      paint → CSS ใน tokens.css ซ่อน body เหลือพื้น surface เฉย ๆ
 *      (ตามรายงาน §7: 0–250ms แสดง splash นิ่ง ไม่ต้องมีอะไร)
 *   2) overlay นี้ (visibility:visible ทะลุ body ที่ถูกซ่อน) ขึ้นตอน
 *      hydrate: ตรา + ข้อความบอกปลายทางจริง + spinner ที่หน่วง 250ms กันกระพริบ
 * § ทำ overlay ฝั่ง client ไม่ใช่ server branch ตาม searchParams — การอ่าน
 * searchParams ใน page.tsx จะฆ่า ISR (revalidate = 3600) ของหน้าแรกทั้งหมด
 *
 * § กัน init ค้าง (hang ไม่ reject): timeout 5 วิ แล้วเดินทางต่อตาม target —
 * หน้าปลายทางมี fallback ฟอร์มเว็บธรรมดาอยู่แล้ว ติด splash นานจะแย่กว่า
 * ส่วน init/โหลด SDK พังแบบ reject ก็เดินทางต่อเช่นกัน ไม่ติดค้าง ไม่ลูป
 *
 * § รับเฉพาะ path ที่ขึ้นต้นด้วย `/` เดี่ยว และห้ามมี `\` — กัน //evil.com
 * (protocol-relative) และ /\evil.com (เบราว์เซอร์ตี backslash เป็น slash)
 * มิฉะนั้นกลายเป็น open-redirect ออกนอก origin — guard ต้องเหมือนกันทั้งใน
 * script ดิบด้านล่าง (ทำงานก่อน React) และใน readLiffStateTarget()
 */

const SPINNER_DELAY_MS = 250;
const NAVIGATE_TIMEOUT_MS = 5_000;

/**
 * § inline script รันตอน HTML parse (component นี้อยู่ต้นสุดของหน้าแรก) ก่อน
 * paint — จึงกวาด landing ออกก่อนที่ผู้ใช้จะเห็นกระพริบ เงื่อนไขเหมือน
 * readLiffStateTarget() เปี๊ยะ และถูก render เฉพาะเมื่อตั้ง LIFF ID แล้ว
 * (ยังไม่ตั้ง = หน้าเว็บธรรมดา ห้ามซ่อนอะไรทั้งสิ้น)
 * setTimeout 8 วิ = เบาะแสปลอดภัย: ถ้า React ไม่ boot เลย (JS error) ให้
 * เปิดหน้าแรกคืนแทนที่จะค้างเป็นจอเปล่าตลอดกาล
 */
const PRE_PAINT_SCRIPT =
  "try{var t=new URLSearchParams(location.search).get('liff.state');" +
  "if(t&&t.charAt(0)==='/'&&t.indexOf('//')!==0&&t.indexOf('\\\\')<0){" +
  "document.documentElement.setAttribute('data-liff-boot','');" +
  "setTimeout(function(){document.documentElement.removeAttribute('data-liff-boot')},8000)" +
  "}}catch(e){}";

export function readLiffStateTarget(): string | null {
  if (typeof window === 'undefined') return null;
  const state = new URLSearchParams(window.location.search).get('liff.state');
  if (!state) return null;
  if (!state.startsWith('/') || state.startsWith('//') || state.includes('\\')) return null;
  return state;
}

/** ข้อความบอกปลายทางจริง — ไม่ใช้ศัพท์กลาง ๆ อย่าง "กำลังเปิดบริการ..." */
export function splashMessage(target: string): string {
  if (target.startsWith('/intake')) return 'กำลังเปิดหน้าแจ้งเรื่อง…';
  if (target.startsWith('/track')) return 'กำลังเปิดหน้าติดตามเรื่อง…';
  return 'กำลังเชื่อมต่อบัญชี LINE…';
}

// § อ่าน target ผ่าน useSyncExternalStore ไม่ใช่ useState ใน effect —
// (a) อ่าน window ตอน render โดยตรงไม่ได้ (SSR ไม่มี window + hydration
//     mismatch) store pattern นี้ให้ server snapshot = null เสมอ แล้วค่อย
//     เปิดเห็นค่าจริงหลัง hydrate — พฤติกรรมเดียวกับที่ต้องการเปี๊ยะ
// (b) setState ตรง ๆ ใน effect ผิดกติกา react-hooks/set-state-in-effect
// ไม่มี subscription จริง (URL เปลี่ยน = หน้าใหม่) จึงเป็น noop — แค่ขอ
// snapshot ที่ถูกต้องตอน render ก็พอ และ cache ตาม search เพื่อคืน reference
// เดิมทุกครั้ง (getSnapshot ต้อง stable ไม่งั้น React วน render ไม่รู้จบ)
const subscribeNoop = () => () => {};
let targetCacheKey = '';
let targetCache: string | null = null;

function getTargetSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  const search = window.location.search;
  if (search !== targetCacheKey) {
    targetCacheKey = search;
    targetCache = readLiffStateTarget();
  }
  return targetCache;
}

export function LiffStateRedirect() {
  const hasLiffId = Boolean(getLiffId());
  const target = useSyncExternalStore(subscribeNoop, getTargetSnapshot, () => null);
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!target) return;

    // React overlay รับต่อจาก pre-paint แล้ว — คืน body ให้เห็นได้ (overlay
    // ทึบ z สูงกว่า Navbar บังอยู่แล้ว จึงไม่มีช่วงจอว่างเปล่าเลย)
    document.documentElement.removeAttribute('data-liff-boot');

    const spinnerTimer = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);

    let navigated = false;
    const go = () => {
      if (navigated) return;
      navigated = true;
      window.location.replace(target);
    };
    const navigateTimer = setTimeout(go, NAVIGATE_TIMEOUT_MS);

    void (async () => {
      const liffId = getLiffId();
      if (liffId) {
        try {
          await loadLiffSdk();
          await window.liff?.init({ liffId });
        } catch {
          // ปล่อยผ่าน — หน้าปลายทาง fallback ฟอร์มเว็บธรรมดา (§ ด้านบน)
        }
      }
      go();
    })();

    return () => {
      clearTimeout(spinnerTimer);
      clearTimeout(navigateTimer);
    };
  }, [target]);

  return (
    <>
      {hasLiffId && <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />}
      {target && (
        <div
          role="status"
          aria-busy="true"
          // § visible ต้องระบุชัด — body ถูก visibility:hidden โดย pre-paint
          // และ visibility สืบทอดลูกจนกว่าจะ override กลับมาเอง
          className="visible fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-surface"
        >
          <BrandMark />
          <p className="text-ink text-base font-medium">{splashMessage(target)}</p>
          {showSpinner && (
            <Loader2 className="text-muted h-6 w-6 animate-spin" aria-hidden="true" />
          )}
        </div>
      )}
    </>
  );
}
