'use client';

import { useEffect } from 'react';

/**
 * § จุดเข้า LIFF ที่มี path (เช่น liff.line.me/<id>/track) จะโดน LINE redirect
 * มาที่หน้าแรก (Endpoint URL = root) ก่อนเสมอ โดยแพ็ค path จริงไว้ใน query
 * `liff.state` — การเด้งต่อไปหน้าจริงเกิดตอนหน้านั้นเรียก liff.init() แต่หน้าแรก
 * ไม่ได้ mount LiffProvider ผู้ใช้เลยติดค้างที่ landing (พบตอนทดสอบ T0)
 *
 * องค์ประกอบนี้อ่าน liff.state แล้ว replace ไปหน้านั้นเอง โดยไม่โหลด LIFF SDK —
 * ผู้เยี่ยมปกติ (ไม่มี liff.state) จึงไม่มีค่าใช้จ่าย JS เพิ่มเติม
 *
 * § รับเฉพาะ path ที่ขึ้นต้นด้วย `/` เดี่ยว และห้ามมี `\` — กัน //evil.com
 * (protocol-relative) และ /\evil.com (เบราว์เซอร์ตี backslash เป็น slash)
 * มิฉะนั้นกลายเป็น open-redirect ออกนอก origin
 */
export function LiffStateRedirect() {
  useEffect(() => {
    const state = new URLSearchParams(window.location.search).get('liff.state');
    if (state && state.startsWith('/') && !state.startsWith('//') && !state.includes('\\')) {
      window.location.replace(state);
    }
  }, []);

  return null;
}
