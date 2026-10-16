import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { authConfig } from '@/auth.config';
import { isTokenExpired } from '@/lib/auth/token-expiry';
import { authorizeCredentials } from '@/lib/auth/authorize-credentials';

/**
 * Auth.js v5 — staff login (Node runtime)
 *
 * Credentials provider + JWT session strategy (ดูเหตุผลใน src/auth.config.ts).
 * ตัว authorize() อยู่ที่ src/lib/auth/authorize-credentials.ts (ค้น user → bcrypt → eligibility)
 *
 * § authorize() ปฏิเสธ citizen/บัญชีระงับหลัง bcrypt ผ่าน โดย throw IneligibleAccountSignin —
 * ไม่ออก JWT ให้ แต่ login action ยังแสดงข้อความเจาะจงได้ (ไม่ใช่ oracle: รหัสถูกแล้ว)
 */

// § type ของ role ที่ใช้ใน session/JWT — single source of truth ใน lib/auth/roles.ts
import type { UserRole } from '@/lib/auth/roles';

// § shape ของข้อมูลที่ authorize() คืน (ฝังลง JWT ใน jwt callback)
// แยกเป็น type ตรงๆ แทนการ augment @auth/core/jwt ซึ่ง resolve ยากใน pnpm strict layout
// expiresAt = unix seconds ที่ session หมดอายุจริง (บังคับใน jwt callback) —
// ต่างจาก cookie maxAge ที่เป็นแค่เพดาน; จำไว้ว่า "จดจำฉัน" = 30d, ไม่จำ = 1h
type AuthToken = {
  userId?: string;
  role?: UserRole;
  expiresAt?: number;
  // § snapshot ของ users.password_version ตอน login — resolveStaff เทียบกับ DB
  // ไม่ตรง = เปลี่ยนรหัสมาแล้วหลัง login → session เดิมใช้ต่อไม่ได้
  passwordVersion?: number;
};

// § augments session.user ด้วย userId + role + passwordVersion — ใช้แทนการ lookup DB ทุก request
// (DB re-check ที่แท้จริงยังทำใน resolveStaff เพื่อ defense-in-depth)
// § passwordVersion เป็น optional — session เก่าที่ออกก่อน migration 0018 ไม่มี field นี้
// resolveStaff เทียบเป็น 1 (ค่า default ของคอลัมน์) จึงไม่เตะ session เก่าที่ยังไม่เปลี่ยนรหัส
declare module 'next-auth' {
  interface Session {
    user: {
      userId: string;
      role: UserRole;
      passwordVersion?: number;
    } & DefaultSession['user'];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      // § id ต้องระบุเพราะใช้หลาย provider ในอนาคตได้ (ตอนนี้มีตัวเดียวก็ตาม)
      id: 'credentials',
      name: 'Staff Login',
      credentials: {
        email: { label: 'อีเมล', type: 'email' },
        password: { label: 'รหัสผ่าน', type: 'password' },
        // § "จดจำฉัน" — กำหนดไว้เพื่อให้ authorize() รับค่าแบบ type-safe (ฟอร์ม custom ส่งเอง)
        remember: { label: 'จดจำฉัน', type: 'checkbox' },
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    // § jwt รันทุกครั้งที่สร้าง/อ่าน/refresh token — เก็บ userId+role จาก authorize ลง JWT
    // (role ที่ฝังใน JWT เป็น snapshot ตอน login เท่านั้น — หาก role/isActive เปลี่ยนกลางคัน
    // ให้พึ่ง DB re-check ใน page.tsx อย่าเพิ่งพึ่ง JWT)
    jwt({ token, user }) {
      const t = token as AuthToken;

      if (user) {
        // user มาจาก authorize() return (มีแค่ตอน sign-in ครั้งแรกเท่านั้น)
        // authorize คืน plain object { id, email, role, passwordVersion, remember } — cast เพราะ DefaultUser ไม่มี field เหล่านี้
        const u = user as { id: string; role: UserRole; passwordVersion?: number; remember?: boolean };
        t.userId = u.id;
        t.role = u.role;
        t.passwordVersion = u.passwordVersion ?? 1;
        // § อายุ session จริง (ไม่ใช่ cookie maxAge): "จดจำฉัน" = 30 วัน, ไม่จำ = 1 ชั่วโมง
        // ตั้งครั้งเดียวตอน sign-in — ไม่ slide ต่ออายุตาม activity (predictable + ปลอดภัย)
        const ttlSeconds = u.remember ? 60 * 60 * 24 * 30 : 60 * 60;
        t.expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
      }

      // § บังคับหมดอายุ: เกิน expiresAt แล้วคืน null → session เป็นโมฆะแม้ cookie (30d) ยังอยู่
      // ฝั่ง middleware มีเช็คเดียวกันใน src/auth.config.ts (jwt edge callback) ซึ่งล้าง cookie ด้วย
      // → authorized เห็น auth เป็น null แล้วเตะกลับ /admin/login ให้ login ใหม่
      // (ใช้ isTokenExpired helper ตัวเดียวกัน — src/lib/auth/token-expiry.ts)
      if (isTokenExpired(t.expiresAt)) {
        return null;
      }

      return token;
    },
    // § session รันทุกครั้งที่อ่าน session ฝั่ง server (auth()) — expose userId+role+passwordVersion จาก JWT
    session({ session, token }) {
      const t = token as AuthToken;
      if (t.userId) session.user.userId = t.userId;
      if (t.role) session.user.role = t.role;
      if (t.passwordVersion !== undefined) session.user.passwordVersion = t.passwordVersion;
      return session;
    },
  },
});
