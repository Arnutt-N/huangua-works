/**
 * Upstash Redis client — rate limiting + session storage
 * ใช้ Redis เพื่อ rate limit (ป้องกัน spam) + cache
 */

import { Redis } from '@upstash/redis';

// Build time: สร้าง stub instance (ไม่เชื่อมจริง)
// Runtime: scripts/verify-env.ts จะ fail fast
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || 'http://localhost:6379';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'stub-token';

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)
) {
  console.warn('[upstash] Upstash not configured — rate limiting disabled');
}

export const redis = new Redis({
  url: REDIS_URL,
  token: REDIS_TOKEN,
});

/**
 * Rate limit helper (sliding window)
 * @param key - rate limit key (e.g., `rate:submit:${ip}`)
 * @param limit - max requests
 * @param windowSeconds - window size in seconds
 * @returns { allowed: boolean, remaining: number, reset: number }
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  // § Graceful degradation — ถ้า Redis ไม่พร้อม (local/dev ไม่มี Upstash REST endpoint)
  // ปล่อยผ่าน + log warn หนึ่งบรรทัด แทนการ throw HTTP 500 ที่บล็อก flow ก่อนถึง DB
  // prod (มี Upstash จริง) ยัง enforce rate limit ปกติ
  try {
    // Remove old entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current entries
    const count = await redis.zcard(key);

    if (count >= limit) {
      // ZRANGE WITHSCORES คืน flat array [member, score, ...] — SDK ไม่แปลงเป็น object
      const oldestEntry = await redis.zrange<(string | number)[]>(key, 0, 0, {
        withScores: true,
      });
      const oldestScore = Number(oldestEntry[1]);
      const reset = Number.isFinite(oldestScore)
        ? Math.ceil((oldestScore + windowSeconds * 1000 - now) / 1000)
        : windowSeconds;

      return { allowed: false, remaining: 0, reset };
    }

    // Add current request
    await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    await redis.expire(key, windowSeconds);

    return {
      allowed: true,
      remaining: limit - count - 1,
      reset: windowSeconds,
    };
  } catch {
    // Redis ไม่ตอบ — ปล่อยผ่านเพื่อไม่ให้ rate-limit บล็อก service
    // (ห้าม leak error detail ออก log — เป็น secret/PII risk; จึงใช้ optional catch binding)
    console.warn('[upstash] rate limit unavailable — allowing request through');
    return { allowed: true, remaining: limit, reset: windowSeconds };
  }
}
