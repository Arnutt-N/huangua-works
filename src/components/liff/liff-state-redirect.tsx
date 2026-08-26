'use client';

import { useEffect } from 'react';
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
 * เท่านั้น ถ้า replace ก่อน init (แบบเดิม) token หลุดทั้งหน้า → หน้าปลายทาง
 * init แล้วไม่มี token → SDK วน auto-login กลับมา landing ซ้ำ = ลูป
 * หน้าโฮม ↔ /intake,/track ไม่รู้จบ (พบตอนทดสอบมือถือจริงหลัง T0)
 *
 * § init พัง (เช่น CDN ไม่ถึง) ก็ยังเดินทางต่อ — หน้าปลายทางจะเห็น provider
 * status 'error' แล้ว fallback เป็นฟอร์มเว็บธรรมดา ดีกว่าติดค้างหน้าแรก
 * และไม่เกิดลูป เพราะ SDK ที่โหลดไม่ได้ก็สั่ง redirect ไม่ได้เหมือนกัน
 *
 * § รับเฉพาะ path ที่ขึ้นต้นด้วย `/` เดี่ยว และห้ามมี `\` — กัน //evil.com
 * (protocol-relative) และ /\evil.com (เบราว์เซอร์ตี backslash เป็น slash)
 * มิฉะนั้นกลายเป็น open-redirect ออกนอก origin
 */
export function readLiffStateTarget(): string | null {
  if (typeof window === 'undefined') return null;
  const state = new URLSearchParams(window.location.search).get('liff.state');
  if (!state) return null;
  if (!state.startsWith('/') || state.startsWith('//') || state.includes('\\')) return null;
  return state;
}

export function LiffStateRedirect() {
  useEffect(() => {
    const target = readLiffStateTarget();
    if (!target) return;

    let cancelled = false;
    void (async () => {
      const liffId = getLiffId();
      if (liffId) {
        try {
          await loadLiffSdk();
          await window.liff?.init({ liffId });
        } catch {
          // ปล่อยผ่าน — ดู § ด้านบนเรื่อง fallback ฝั่งหน้าปลายทาง
        }
      }
      if (!cancelled) window.location.replace(target);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
