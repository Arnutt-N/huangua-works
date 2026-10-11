import { redis } from '@/lib/upstash';

/**
 * Circuit breaker สำหรับ LINE API — กัน LINE ล่มลามทั้ง webhook
 *
 * § state ใน Redis ต่อ endpoint: fail count + open-until timestamp
 * - ล้มติดกันครบ FAILURE_THRESHOLD (5) → open OPEN_SECONDS (30): fast-fail ทันทีไม่ยิงจริง
 * - ครบ cooldown → half-open (ลอง 1 ครั้ง): สำเร็จปิดวงจร, ล้มเปิดต่อ
 * - สำเร็จคั่นกลาง reset ตัวนับ
 * - Redis ล่ม → fail-open (ยิงตรงเหมือนเดิม): LINE client ไม่ใช่ auth path
 */

const FAILURE_THRESHOLD = 5;
const OPEN_SECONDS = 30;

const failsKey = (endpoint: string) => `line:circuit:${endpoint}:fails`;
const openKey = (endpoint: string) => `line:circuit:${endpoint}:open`;

export class LineCircuitOpenError extends Error {
  constructor(endpoint: string) {
    super(`LINE API circuit is open (${endpoint})`);
    this.name = 'LineCircuitOpenError';
  }
}

export async function withLineCircuit<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
  let degraded = false;

  try {
    const openUntil = await redis.get(openKey(endpoint));
    if (openUntil !== null && Number(openUntil) > Date.now()) {
      throw new LineCircuitOpenError(endpoint);
    }
  } catch (error) {
    if (error instanceof LineCircuitOpenError) throw error;
    degraded = true;
    console.warn('[line-circuit] state unavailable — fail-open');
  }

  try {
    const result = await fn();
    if (!degraded) {
      await redis.del(failsKey(endpoint), openKey(endpoint)).catch(() => {});
    }
    return result;
  } catch (error) {
    if (!degraded) {
      await recordFailure(endpoint).catch(() => {});
    }
    throw error;
  }
}

async function recordFailure(endpoint: string): Promise<void> {
  const raw = await redis.get(failsKey(endpoint));
  const fails = (raw === null ? 0 : Number(raw) || 0) + 1;
  if (fails >= FAILURE_THRESHOLD) {
    await redis.set(openKey(endpoint), String(Date.now() + OPEN_SECONDS * 1000), { ex: OPEN_SECONDS * 2 });
    await redis.del(failsKey(endpoint));
  } else {
    await redis.set(failsKey(endpoint), String(fails), { ex: OPEN_SECONDS * 2 });
  }
}
