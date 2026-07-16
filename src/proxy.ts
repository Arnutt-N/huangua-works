import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

/**
 * Proxy (Next.js 16 เปลี่ยนชื่อจาก middleware.ts → proxy.ts)
 *
 * คุมเฉพาะ /admin/* — หน้าอื่น (/, /intake, /track) ไม่แตะ auth session เลย
 *
 * § ต้องใช้ NextAuth(authConfig).auth (edge-safe config เท่านั้น) ไม่ใช่ `auth` จาก
 * src/auth.ts — เพราะอันนั้น import bcrypt + postgres-js (Node-only) ที่ไม่ทำงานใน edge
 * runtime ของ proxy ทำให้ proxy ไม่สามารถ decode session cookie เป็น `auth` object ได้
 * ผลคือ authorized callback เห็น auth เป็น null เสมอ = redirect loop (login แล้วเตะกลับ)
 *
 * authorized callback (ใน src/auth.config.ts) เป็นคนตัดสินใจ redirect เอง
 * ไม่ทำ role/isActive check ที่นี่ (ต้องคิว DB, proxy ควรเร็ว/ไม่แตะ DB)
 * role check จริงอยู่ที่ admin/actions.ts (login) + admin/page.tsx (defensive re-check)
 *
 * Next.js 16 deprecate middleware.ts แล้ว — ไฟล์ต้องชื่อ proxy.ts ถึงจะถูก invoke
 * ทุก request (ที่ match matcher) ไม่งั้น authorized callback ไม่ทำงาน = redirect หาย
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ['/admin/:path*'],
};
