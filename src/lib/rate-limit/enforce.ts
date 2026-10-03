import { checkRateLimit } from '@/lib/upstash';
import { RATE_LIMIT_POLICIES, rateLimitKey, type RateLimitPolicyName } from './policies';

export type RateLimitResult = { allowed: boolean; remaining: number; reset: number };

/**
 * ตรวจ rate limit ตามนโยบายที่ตั้งชื่อไว้ใน RATE_LIMIT_POLICIES
 *
 * § caller ไม่เลือก limit / window / failOpen เองอีกต่อไป — เดิม 8 caller ประกอบค่าเอง
 * และค่า default ของ checkRateLimit คือ fail-open ถ้าลืม { failOpen: false } ที่ auth path
 * ไหน path นั้นไม่มีกัน brute-force ทันทีที่ Redis ล่ม (ไม่มี test ไหนจับได้)
 * checkRateLimit (zadd → zrank) เป็น implementation ข้างใน ไม่ถูกแก้
 */
export async function enforceRateLimit(name: RateLimitPolicyName, subject: string): Promise<RateLimitResult> {
  const policy = RATE_LIMIT_POLICIES[name];
  return checkRateLimit(rateLimitKey(name, subject), policy.limit, policy.windowSeconds, {
    failOpen: !policy.failClosed,
  });
}
