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
 * @param opts.failOpen - true (default): Redis down ⇒ allow (keep service alive)
 *                        false: Redis down ⇒ reject (fail-secure สำหรับ login path)
 * @returns { allowed: boolean, remaining: number, reset: number }
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  opts: { failOpen?: boolean } = {}
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const failOpen = opts.failOpen ?? true;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  // § Graceful degradation — ถ้า Redis ไม่พร้อม (local/dev ไม่มี Upstash REST endpoint)
  // ปล่อยผ่าน + log warn หนึ่งบรรทัด แทนการ throw HTTP 500 ที่บล็อก flow ก่อนถึง DB
  // prod (มี Upstash จริง) ยัง enforce rate limit ปกติ
  try {
    // Remove old entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // § เพิ่มตัวเองก่อน แล้วตัดสินจาก "ตำแหน่งของตัวเอง" ไม่ใช่จำนวนรวม
    // ห้ามสลับกลับไปเป็น "นับก่อน แล้วค่อยเพิ่ม" — ลำดับนั้นไม่ atomic: request ที่ยิง
    // พร้อมกัน N ตัวอ่าน count ตัวเดียวกันก่อนที่ใครจะ zadd ทัน จึงผ่าน gate ได้ทั้งหมด
    // = brute-force ทะลุ limit ที่ login/password-reset พึ่งอยู่
    //
    // และห้ามใช้ zcard หลัง zadd ด้วย — ปิด race ได้ก็จริงแต่เหวี่ยงเกินไป: ถ้า N ตัว
    // zadd เสร็จก่อนที่ใครจะนับ ทุกตัวจะเห็น count = N แล้วถูกปฏิเสธ "ทั้งหมด" แม้ตัวแรกๆ
    // ควรผ่าน — สำคัญกับที่นี่เพราะประชาชนหลายคนอาจออกเน็ตผ่าน IP เดียวกันหลัง NAT
    //
    // zrank คืนลำดับของ member ตัวเองในเซ็ต (0-based) จึงตัดสินได้แม่นยำว่า "ฉันเป็น
    // คนที่เท่าไหร่ในหน้าต่างนี้" ไม่ว่า request อื่นจะแทรกตอนไหน → ผ่านพอดี limit ตัวแรก
    // เสมอ ไม่มากไม่น้อย โดยไม่ต้องพึ่ง Lua/MULTI (ซึ่งเสี่ยงกับ up-redis proxy ใน local)
    //
    // (ตั้งใจให้ request ที่ถูกปฏิเสธยังคงอยู่ในหน้าต่าง — ความพยายามที่ล้มเหลวควรนับรวม
    //  สำหรับ path กัน brute-force)
    const member = `${now}-${Math.random()}`;
    await redis.zadd(key, { score: now, member });
    await redis.expire(key, windowSeconds);

    const rank = await redis.zrank(key, member);

    // rank เป็น null ไม่ควรเกิด (เพิ่งเพิ่มเอง) — ถ้าเกิดให้ถือว่าเกิน ปลอดภัยกว่าปล่อยผ่าน
    if (rank === null || rank >= limit) {
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

    return {
      allowed: true,
      remaining: limit - rank - 1,
      reset: windowSeconds,
    };
  } catch {
    // Redis ไม่ตอบ — policy ตาม opts.failOpen
    // (ห้าม leak error detail ออก log — เป็น secret/PII risk; จึงใช้ optional catch binding)
    if (failOpen) {
      console.warn('[upstash] rate limit unavailable — allowing request (fail-open)');
      return { allowed: true, remaining: limit, reset: windowSeconds };
    }
    // § fail-secure: ปิด brute-force path เมื่อ Redis ล่ม (login ควรใช้ policy นี้กัน brute-force no-limit)
    console.warn('[upstash] rate limit unavailable — rejecting request (fail-secure)');
    return { allowed: false, remaining: 0, reset: windowSeconds };
  }
}
