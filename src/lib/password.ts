import bcrypt from 'bcryptjs';

/**
 * Password hashing — bcrypt (pure JS, ไม่ต้อง native build รัน Windows ได้)
 *
 * cost factor 10 ≈ ~100ms ต่อการ hash/verify บนเครื่อง dev ทั่วไป
 * (เพียงพอต่อการต้าน offline brute-force สำหรับระบบ staff ที่ใช้รหัสผ่านตั้ง)
 *
 * ใช้แทน Supabase Auth (GoTrue) ที่เคยจัดการ hash ให้ฝั่ง service ฝั่งเดียว
 * หลังย้าย stack เป็น plain Postgres + Auth.js v5 (Credentials provider + JWT session)
 *
 * ทั้งคู่ export เป็น async เพราะ bcrypt ใช้ libuv threadpool (ไม่บล็อก event loop)
 *
 * § ไม่ใส่ 'server-only' guard เพราะไฟล์นี้ต้อง import ได้จาก scripts/seed.ts (plain tsx,
 * ไม่ใช่ Next.js bundler context — 'server-only' throw unconditionally นอก context นั้น)
 * ความปลอดภัยจริงมาจาก: ไม่มี caller ฝั่ง client, hash ไม่ leak ผ่าน error, และ passwordHash
 * ไม่เคย select โดยไม่จำเป็น (authorize callback เท่านั้นที่อ่าน)
 */

const COST_FACTOR = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // bcrypt.compare คืน false (ไม่ throw) เมื่อ hash malformed — เทียบเท่า "รหัสผ่านไม่ถูก"
  return bcrypt.compare(plain, hash);
}
