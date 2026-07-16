import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

import { authConfig } from '@/auth.config';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { users, userRoleEnum } from '@/lib/db/schema';

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

// § type ของ role ที่ใช้ใน session/JWT — derive จาก pgEnum เพื่อซิงค์กับ schema.ts อัตโนมัติ
type UserRole = (typeof userRoleEnum.enumValues)[number];

// § shape ของข้อมูลที่ authorize() คืน (ฝังลง JWT ใน jwt callback)
// แยกเป็น type ตรงๆ แทนการ augment @auth/core/jwt ซึ่ง resolve ยากใน pnpm strict layout
type AuthToken = {
  userId?: string;
  role?: UserRole;
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

        // § คืนเฉพาะข้อมูลจำเป็น ไม่ส่ง passwordHash ไปฝั่ง JWT
        return {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    // § jwt รันทุกครั้งที่สร้าง/อ่าน/refresh token — เก็บ userId+role จาก authorize ลง JWT
    // (role ที่ฝังใน JWT เป็น snapshot ตอน login เท่านั้น — หาก role/isActive เปลี่ยนกลางคัน
    // ให้พึ่ง DB re-check ใน page.tsx อย่าเพิ่งพึ่ง JWT)
    jwt({ token, user }) {
      if (user) {
        // user มาจาก authorize() return (มีแค่ตอน sign-in ครั้งแรกเท่านั้น)
        // authorize คืน plain object { id, email, role } — cast เพราะ DefaultUser ไม่มี role
        const u = user as { id: string; role: UserRole };
        (token as AuthToken).userId = u.id;
        (token as AuthToken).role = u.role;
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
