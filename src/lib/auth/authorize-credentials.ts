import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { users } from '@/lib/db/schema';
import { loginDenialReason } from './roles';
import { IneligibleAccountSignin } from './login-errors';

/**
 * ตัว authorize() ของ Credentials provider (src/auth.ts) — แยกออกมาให้ทดสอบได้
 * ทำหน้าที่เดียวกับ Supabase signInWithPassword เดิม:
 *   1. ค้น user ด้วย email (case-insensitive ผ่าน normalized input)
 *   2. verify bcrypt hash ใน users.password_hash
 *   3. ตัดสิน eligibility (citizen / บัญชีระงับ) หลังรหัสถูกเท่านั้น
 *   4. คืน { id, email, role, passwordVersion, remember } ฝังลง JWT ผ่าน jwt callback
 */

// § DUMMY_HASH module-scope — bcrypt จริงของ random password ที่ไม่มีใครรู้
// สร้างครั้งเดียว ไม่ใช่ทุก request (กัน timing oracle: compare รันเต็ม cost เสมอ)
const DUMMY_HASH = '$2a$10$JbkZT1hKzXmNDkD92B.F3OOPQG9RWfw6ZeWeL/WUvSyENYkMlnB56';

export type AuthorizedUser = Pick<typeof users.$inferSelect, 'id' | 'email' | 'role' | 'passwordVersion'> & {
  remember: boolean;
};

export async function authorizeCredentials(
  credentials: Partial<Record<string, unknown>> | undefined,
): Promise<AuthorizedUser | null> {
  // § รหัสผิด/ไม่มี user/input ไม่ครบ = คืน null เหมือนกันทุกกรณี (ไม่เป็น oracle)
  // ปฏิเสธสิทธิ์ด้วย IneligibleAccountSignin หลังรหัสถูก ส่วน error จาก DB/bcrypt ส่งต่อให้ Auth.js จัดการ
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
  // จาก timing ไม่ได้) — rate limit ต่อ IP/email อยู่ที่ login action ซึ่งเป็นทางเข้าเดียว
  // (HTTP credentials callback ถูกบล็อกใน src/app/api/auth/[...nextauth]/route.ts)
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!user || !user.passwordHash || !ok) return null;

  // § ตัดสิน eligibility หลัง bcrypt ผ่านเท่านั้น (timing เท่าทุกกรณี) — citizen/บัญชีระงับ
  // ไม่ได้ JWT แต่ throw เหตุผลให้ login action แสดงข้อความเจาะจง (ไม่ใช่ oracle: รหัสถูกแล้ว)
  const denial = loginDenialReason(user.role, user.isActive);
  if (denial) throw new IneligibleAccountSignin(denial, user.id);

  // § remember ฟอร์มส่งมาเป็น string ('on' เมื่อติ๊ก) — แปลงเป็น boolean
  // ส่งต่อให้ jwt callback กำหนดอายุ session (1h vs 30d)
  const remember = credentials?.remember === 'on' || credentials?.remember === 'true';

  // § คืนเฉพาะข้อมูลจำเป็น ไม่ส่ง passwordHash ไปฝั่ง JWT
  // § passwordVersion = snapshot ตัด session ค้างหลังเปลี่ยนรหัส
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    passwordVersion: user.passwordVersion,
    remember,
  };
}
