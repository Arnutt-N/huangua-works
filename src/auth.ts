import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

import { authConfig } from '@/auth.config';
import { isTokenExpired } from '@/lib/auth/token-expiry';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { users } from '@/lib/db/schema';

/**
 * Auth.js v5 — staff login (Node runtime)
 *
 * Credentials provider + JWT session strategy (ดูเหตุผลใน src/auth.config.ts).
 * authorize() ทำหน้าที่เดียวกับ Supabase signInWithPassword เดิม:
 *   1. ค้น user ด้วย email (case-insensitive ผ่าน normalized input)
 *   2. verify bcrypt hash ใน users.password_hash
 *   3. คืน { id, email, role } ฝังลง JWT ผ่าน jwt callback
 *
 * § authorize() ไม่ทำ role/isActive check — เหมือนเดิม (เดิมทำใน actions.ts หลัง signIn)
 * เพราะต้องการ error message เจาะจง (เช่น "บัญชีถูกระงับ") และไม่เป็น enumeration oracle
 * (ตรวจ role/isActive หลังยืนยันรหัสผ่านผ่านแล้ว จึงไม่เปิดให้เดา email จาก error ที่ต่างกัน)
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
};

// § augments session.user ด้วย userId + role — ใช้แทนการ lookup DB ทุก request
// (DB re-check ที่แท้จริงยังทำใน src/app/admin/page.tsx เพื่อ defense-in-depth)
declare module 'next-auth' {
  interface Session {
    user: {
      userId: string;
      role: UserRole;
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
      async authorize(credentials) {
        // § ไม่ throw ใน authorize — คืน null เสมอเมื่อ fail (Auth.js จะแปลงเป็น error flow)
        // throwing ทำให้เสี่ยง leak internal error ไปยัง client
        const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!email || !password) return null;

        const db = await getDb();
        const user = await firstOrUndefined(
          db.select().from(users).where(eq(users.email, email)).limit(1)
        );

        // § ไม่แยก "ไม่มี user" กับ "รหัสผ่านผิด" ที่นี่ — ทั้งคู่คืน null (เหมือนกัน)
        // กัน timing oracle: bcrypt.compare รันเสมอแม้ user ไม่มีอยู่จริง ด้วย DUMMY_HASH ปลอม
        // (ผลลัพธ์ compare จะเป็น false แต่ใช้เวลาเท่ากับ verify จริง ~100ms → attacker แยก email
        // จาก timing ไม่ได้) — เพิ่มเติมด้วย per-email rate-limit ใน actions.ts
        // DUMMY_HASH เป็น bcrypt จริงของ random password ที่ไม่มีใครรู้ ใช้ ensure compare รันเต็ม cost
        const DUMMY_HASH = '$2a$10$JbkZT1hKzXmNDkD92B.F3OOPQG9RWfw6ZeWeL/WUvSyENYkMlnB56';
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const ok = await bcrypt.compare(password, hash);
        if (!user || !user.passwordHash || !ok) return null;

        // § remember ฟอร์มส่งมาเป็น string ('on' เมื่อติ๊ก) — แปลงเป็น boolean
        // ส่งต่อให้ jwt callback กำหนดอายุ session (1h vs 30d)
        const remember = credentials?.remember === 'on' || credentials?.remember === 'true';

        // § คืนเฉพาะข้อมูลจำเป็น ไม่ส่ง passwordHash ไปฝั่ง JWT
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          remember,
        };
      },
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
        // authorize คืน plain object { id, email, role, remember } — cast เพราะ DefaultUser ไม่มี field เหล่านี้
        const u = user as { id: string; role: UserRole; remember?: boolean };
        t.userId = u.id;
        t.role = u.role;
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
    // § session รันทุกครั้งที่อ่าน session ฝั่ง server (auth()) — expose userId+role จาก JWT
    session({ session, token }) {
      const t = token as AuthToken;
      if (t.userId) session.user.userId = t.userId;
      if (t.role) session.user.role = t.role;
      return session;
    },
  },
});
