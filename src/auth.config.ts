import type { NextAuthConfig } from 'next-auth';

/**
 * Auth.js v5 config สำหรับ edge runtime (middleware)
 *
 * แยกจาก src/auth.ts (Node runtime) เพราะ middleware รันบน edge ที่ไม่สามารถ
 * ต่อ Postgres หรือ import bcryptjs ได้ — ไฟล์นี้ต้อง "weightless" (ไม่ pull DB/driver).
 *
 * provider/authorize logic อยู่ใน src/auth.ts (จะถูก merge ผ่าน NextConfig ตอน init)
 * ส่วน callback ที่จำเป็นต้องรันบนทุก request (รวม middleware) วางที่นี่
 */
export const authConfig = {
  // § Credentials provider (email+password) บังคับให้ใช้ JWT — Auth.js v5 ไม่รองรับ
  // database session strategy กับ Credentials (provider ไม่ไหลผ่าน adapter เหมือน OAuth)
  // revoke ของจริง (suspend บัญชีกลางคัน) ทำผ่าน per-request role/isActive DB re-check
  // ใน src/app/admin/page.tsx แทน — พฤติกรรมเทียบเท่า Supabase เดิม (JWT 1h + re-check ทุกหน้า)
  session: { strategy: 'jwt' },
  // § ตั้ง secret อย่างชัดเจน — Auth.js v5 ปกติอ่าน AUTH_SECRET จาก env เอง แต่ edge runtime
  // ของ proxy บางครั้งไม่ได้รับ env เดียวกับ Node runtime ทำให้ decode JWT ไม่ได้ = redirect loop
  // (login สำเร็จใน Node runtime แต่ proxy อ่าน cookie เป็นค่าว่าง)
  secret: process.env.AUTH_SECRET,
  // § trustHost จำเป็นสำหรับ local dev — ไม่งั้น Auth.js v5 จะ reject request
  // ที่ Host header ไม่ตรง AUTH_URL ทำให้ middleware อ่าน session cookie ไม่ได้
  // production: ปิด trustHost ทั้งหมด → enforce canonical AUTH_URL (กัน Host header spoofing
  // ที่ attacker ส่งเข้ามาหลอก Auth.js callback URL — สำคัญเมื่อเพิ่ม OAuth/magic-link provider)
  trustHost: process.env.NODE_ENV !== 'production',
  pages: {
    signIn: '/admin/login',
  },
  providers: [
    // ว่างเสมอที่นี่ — authorize callback จริงของ Credentials เพิ่มใน src/auth.ts
    // เพื่อให้ edge bundle ไม่ดึง postgres-js/bcryptjs เข้ามา
  ],
  callbacks: {
    // § authorized รันใน middleware — ปิด gate /admin/* ถ้าไม่มี session
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === '/admin/login';

      // ไม่ล็อกอิน + ไม่ใช่หน้า login → เตะไป login
      // ล็อกอินแล้ว + อยู่ที่หน้า login → บอกไป dashboard
      // (role/isActive check ไม่ทำที่นี่ — ต้องคิว DB, middleware ต้องเร็ว/ไม่ติด DB)
      if (!isLoggedIn && !isLoginPage) return false;
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL('/admin', nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
