import { Redis } from '@upstash/redis';

/**
 * ล้าง rate-limit key ก่อนรัน E2E — กัน flaky test เวลารันซ้ำภายใน window เดิม
 * (เช่น dev รัน `pnpm test:e2e` ซ้ำหลายรอบระหว่างพัฒนา)
 *
 * รับ key ตรงๆ ไม่ใช่ prefix — up-redis (REST proxy) บล็อกคำสั่ง KEYS โดย default
 * (ป้องกัน blocking scan บน shared connection) จึงต้องรู้ชื่อ key ล่วงหน้า
 */
export async function resetRateLimits(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || 'http://localhost:8081',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || 'local-dev-token-0123456789',
  });

  await redis.del(...keys);
}
