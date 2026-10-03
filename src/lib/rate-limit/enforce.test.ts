import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RATE_LIMIT_POLICIES, type RateLimitPolicyName } from './policies';

/**
 * enforceRateLimit — พิสูจน์ "ระดับพฤติกรรม" ว่า auth path ปิดจริงเมื่อ Redis ล่ม
 * (policies.test.ts พิสูจน์แค่ตาราง ไฟล์นี้พิสูจน์ว่าตารางถูกส่งต่อให้ checkRateLimit ถูก)
 * mock ที่ระดับ @upstash/redis เพื่อให้ checkRateLimit ตัวจริงทำงาน
 */
const redisState = vi.hoisted(() => ({ down: false, keys: [] as string[] }));

vi.mock('@upstash/redis', () => {
  const guard = async () => {
    if (redisState.down) throw new Error('ECONNREFUSED');
  };
  return {
    Redis: class {
      zremrangebyscore = async (key: string) => {
        await guard();
        redisState.keys.push(key);
      };
      zadd = async () => guard();
      expire = async () => guard();
      zrank = async () => {
        await guard();
        return 0;
      };
      zrange = async () => {
        await guard();
        return [];
      };
    },
  };
});

const { enforceRateLimit } = await import('./enforce');
const NAMES = Object.keys(RATE_LIMIT_POLICIES) as RateLimitPolicyName[];

beforeEach(() => {
  redisState.down = false;
  redisState.keys = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('enforceRateLimit · Redis ล่ม', () => {
  it.each(NAMES.filter((n) => RATE_LIMIT_POLICIES[n].kind === 'auth'))('%s (auth) ปฏิเสธ', async (name) => {
    redisState.down = true;
    const result = await enforceRateLimit(name, 'subject');
    expect(result.allowed).toBe(false);
  });

  it.each(NAMES.filter((n) => RATE_LIMIT_POLICIES[n].kind === 'public'))('%s (public) ปล่อยผ่าน', async (name) => {
    redisState.down = true;
    const result = await enforceRateLimit(name, 'subject');
    expect(result.allowed).toBe(true);
  });
});

describe('enforceRateLimit · Redis ปกติ', () => {
  it('ส่ง key ตาม rateLimitKey และ limit ตามตาราง', async () => {
    const result = await enforceRateLimit('submit', '203.0.113.9');

    expect(redisState.keys).toEqual(['rate:submit:203.0.113.9']);
    expect(result).toEqual({ allowed: true, remaining: RATE_LIMIT_POLICIES.submit.limit - 1, reset: 300 });
  });
});
