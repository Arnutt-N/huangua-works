import { redis } from '@/lib/upstash';

/**
 * เลข version ของค่าบอทใน Redis — สะพานให้ cache ของแต่ละ process รู้ว่ามีคนเขียนค่าใหม่
 *
 * § เหตุที่ต้องมี: cache ค่าบอทอยู่ใน memory ของแต่ละ process และบน Vercel route admin
 * ที่บันทึกค่ากับ webhook ที่อ่านค่าเป็นคนละ lambda (เหตุผลเดียวกับ § ใน sse/broadcaster.ts)
 * invalidate ใน process ตัวเองจึงไปไม่ถึงบอท — ผู้เขียน INCR เลขนี้ ผู้อ่านเทียบเป็นระยะ
 * ทุกฟังก์ชันในไฟล์นี้ไม่ throw: Redis ล่มแค่ทำให้ช้าลงเป็น TTL 60 วินาทีแบบเดิม
 */

export type BotConfigScope = 'settings' | 'intents';

// ไม่มี env Upstash (dev/test ที่ไม่ได้ยก up-redis) → ไม่เรียก Redis เลย
// เพราะ client ที่ชี้ host stub จะ retry หลายวินาทีต่อคำสั่ง ถ่วงการตอบทุกข้อความ
const REDIS_ENABLED = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);
const READ_TIMEOUT_MS = 500;

export function configVersionKey(scope: BotConfigScope): string {
  return `bot-config:version:${scope}`;
}

export async function readConfigVersion(scope: BotConfigScope): Promise<string | null> {
  if (!REDIS_ENABLED) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), READ_TIMEOUT_MS);
    });
    const value = await Promise.race([
      redis.get<string | number>(configVersionKey(scope)),
      timeout,
    ]);
    return value === null || value === undefined ? null : String(value);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function bumpConfigVersion(scope: BotConfigScope): Promise<void> {
  if (!REDIS_ENABLED) return;
  try {
    await redis.incr(configVersionKey(scope));
  } catch {
    // ไม่ log error detail (secret/PII risk เหมือน upstash.ts) — ค่าใน DB บันทึกสำเร็จแล้ว
    console.warn(`[bot-config] bump version ของ ${scope} ไม่สำเร็จ — process อื่นจะเห็นค่าใหม่หลัง TTL`);
  }
}
