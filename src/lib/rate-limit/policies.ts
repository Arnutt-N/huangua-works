/**
 * นโยบาย rate limit ทั้งระบบ — ที่เดียวที่ตัดสินว่า path ไหนจำกัดกี่ครั้ง ต่อกี่วินาที
 * และ "ปิดหรือเปิด" เมื่อ Redis ล่ม caller เลือกนโยบายตามชื่อผ่าน enforceRateLimit()
 *
 * § ไฟล์นี้ห้าม import อะไรเลย (pure) — e2e/*.spec.ts import ตรงจาก Playwright process
 * เพื่อสร้าง key ที่จะล้าง ถ้าดึง @upstash/redis หรือ next/* เข้ามาจะโหลดไม่ได้ในนั้น
 *
 * § รูปแบบ key `rate:<scope>:<subject>` ต้องคงเดิมทุก byte — key ที่กำลังนับอยู่ใน Redis
 * production ตอน deploy จะนับต่อได้ (ไม่มีช่วงที่ limit ถูก reset ให้ attacker)
 *
 * kind = 'auth' คือ path ที่ยืนยันตัวตนหรือเป็น oracle ให้เดาความลับได้ (รหัสผ่าน, token,
 * CID, LINE ID token) — ต้อง failClosed เสมอ (Redis ล่ม = ปฏิเสธ) ไม่งั้น brute-force
 * protection หายเงียบ ๆ ตอน Redis ล่ม (บังคับด้วย policies.test.ts)
 * kind = 'public' คือบริการประชาชนที่ต้องไม่ล่มตาม Redis — failClosed: false
 */

export type RateLimitKind = 'auth' | 'public';

export interface RateLimitPolicy {
  readonly prefix: string;
  readonly limit: number;
  readonly windowSeconds: number;
  readonly kind: RateLimitKind;
  /** true = Redis ล่มแล้วปฏิเสธ (fail-secure) · false = ปล่อยผ่าน (fail-open) */
  readonly failClosed: boolean;
}

export const RATE_LIMIT_POLICIES = {
  // § จำกัดทั้งต่อ IP และต่อ email แยกกัน — IP ปลอมผ่าน X-Forwarded-For ได้ง่าย
  // แต่ per-email ผูกกับบัญชีเป้าหมาย ไม่ใช่ header ที่ client กำหนดเอง
  adminLoginIp: { prefix: 'rate:admin-login:ip', limit: 5, windowSeconds: 900, kind: 'auth', failClosed: true },
  adminLoginEmail: { prefix: 'rate:admin-login:email', limit: 5, windowSeconds: 900, kind: 'auth', failClosed: true },
  // กัน email bombing + brute-force ลอง email (per-email เข้มกว่า: 3 ครั้ง)
  pwResetIp: { prefix: 'rate:pw-reset:ip', limit: 5, windowSeconds: 900, kind: 'auth', failClosed: true },
  pwResetEmail: { prefix: 'rate:pw-reset:email', limit: 3, windowSeconds: 900, kind: 'auth', failClosed: true },
  pwResetComplete: { prefix: 'rate:pw-reset:complete', limit: 5, windowSeconds: 900, kind: 'auth', failClosed: true },
  // ฟอร์มยืนยันรหัสผ่านเดิม = oracle เดารหัสได้ถ้า session ถูกขโมย — subject คือ userId
  changePassword: { prefix: 'rate:change-password', limit: 5, windowSeconds: 900, kind: 'auth', failClosed: true },
  liffSession: { prefix: 'rate:liff-session', limit: 5, windowSeconds: 300, kind: 'auth', failClosed: true },
  // ยืนยันตัวตนด้วย trackingCode + CID และทำงานทำลายข้อมูล (ถอนความยินยอม)
  consentWithdraw: { prefix: 'rate:consent-withdraw', limit: 5, windowSeconds: 600, kind: 'auth', failClosed: true },
  submit: { prefix: 'rate:submit', limit: 3, windowSeconds: 300, kind: 'public', failClosed: false },
  // กัน brute force tracking code — public แต่ข้อมูลที่คืนถอด PII แล้ว
  track: { prefix: 'rate:track', limit: 10, windowSeconds: 300, kind: 'public', failClosed: false },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

export function rateLimitKey(name: RateLimitPolicyName, subject: string): string {
  return `${RATE_LIMIT_POLICIES[name].prefix}:${subject}`;
}
