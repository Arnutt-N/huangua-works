import type { NextAuthConfig } from 'next-auth';
import { isTokenExpired } from '@/lib/auth/token-expiry';

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
  // § maxAge 30 วัน — นี่เป็นแค่ "อายุ cookie สูงสุด" สำหรับเคส remember-me; อายุ session
  // จริงถูกบังคับราย token ผ่าน expiresAt claim ใน jwt callback (src/auth.ts):
  // ไม่ติ๊ก "จดจำฉัน" = 1h, ติ๊ก = 30d — jwt คืน null เมื่อเกิน expiresAt แม้ cookie ยังอยู่
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  // § ตั้ง secret อย่างชัดเจน — Auth.js v5 ปกติอ่าน AUTH_SECRET จาก env เอง แต่ edge runtime
  // ของ proxy บางครั้งไม่ได้รับ env เดียวกับ Node runtime ทำให้ decode JWT ไม่ได้ = redirect loop
  // (login สำเร็จใน Node runtime แต่ proxy อ่าน cookie เป็นค่าว่าง)
  secret: process.env.AUTH_SECRET,
  // § trustHost ต้องเป็น true เสมอเมื่อรันหลัง reverse proxy (Vercel/Cloud Run/nginx) —
  // Auth.js อ่าน host จาก X-Forwarded-Host ซึ่งเชื่อถือได้ก็ต่อเมื่อ proxy เป็นคนใส่ให้
  // ตั้ง false = Auth.js คืน UntrustedHost → ทุก endpoint /api/auth/* ตอบ 500
  // "There was a problem with the server configuration" → login พังทั้งระบบ
  // การกัน Host header spoofing บน Vercel เป็นหน้าที่ของ platform + canonical AUTH_URL
  // ไม่ใช่ flag นี้ (flag นี้แค่บอกว่า "เชื่อ forwarded header ได้ไหม")
  trustHost: true,
  pages: {
    signIn: '/admin/login',
  },
  providers: [
    // ว่างเสมอที่นี่ — authorize callback จริงของ Credentials เพิ่มใน src/auth.ts
    // เพื่อให้ edge bundle ไม่ดึง postgres-js/bcryptjs เข้ามา
  ],
  callbacks: {
    // § jwt (edge) — บังคับ expiresAt ใน middleware ด้วย
    // expiresAt ถูกตั้งตอน sign-in โดย jwt callback ใน src/auth.ts (Node) แล้วฝังใน cookie;
    // ที่นี่อ่านค่าเดิมมาเช็ค — เกินอายุให้คืน null → middleware เห็น session เป็น null
    // และ Auth.js จะล้าง cookie ทิ้ง (sessionStore.clean()) กัน redirect loop กับ authorized
    // ถ้าไม่มี callback นี้ middleware จะดูแค่ exp ของ cookie (30d ตาม maxAge) ทำให้
    // session จริงที่หมดอายุแล้ว (1h) ยังลอด gate เข้า /admin ได้
    // (weightless: เทียบ timestamp ล้วน ไม่แตะ DB — รันบน edge ได้)
    jwt({ token }) {
      const expiresAt = (token as { expiresAt?: number }).expiresAt;
      if (isTokenExpired(expiresAt)) {
        return null;
      }
      return token;
    },
    // § authorized รันใน middleware — ปิด gate /admin/* ถ้าไม่มี session
    // § forgot/reset password ต้องเข้าถึงได้ตอนยังไม่ได้ login (self-service reset)
    // จึงรวมไว้ใน public allowlist ด้วย — ไม่ใช่หน้า admin ที่ต้อง auth
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/forgot-password', '/admin/reset-password'];
      const isPublicPage = PUBLIC_ADMIN_PATHS.includes(nextUrl.pathname);

      // ไม่ล็อกอิน + ไม่ใช่หน้า public → เตะไป login
      // ล็อกอินแล้ว + อยู่ที่หน้า login → บอกไป dashboard
      // (role/isActive check ไม่ทำที่นี่ — ต้องคิว DB, middleware ต้องเร็ว/ไม่ติด DB)
      if (!isLoggedIn && !isPublicPage) return false;
      if (isLoggedIn && nextUrl.pathname === '/admin/login') {
        return Response.redirect(new URL('/admin', nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
