import { describe, expect, test } from 'vitest';
import { bumpConfigVersion, configVersionKey, readConfigVersion } from './config-version';
import { redis } from '@/lib/upstash';

/**
 * Integration — ต้องมี `docker compose up -d redis up-redis`
 * § พิสูจน์สิ่งที่ mock พิสูจน์ไม่ได้: up-redis/Upstash คืนค่า INCR ผ่าน GET ในรูปที่
 * readConfigVersion แปลงเป็น string ได้ และเลขเพิ่มขึ้นจริงทีละ 1
 * (ไม่ลบ key หลังเทสต์ — ลบแล้ว dev server ที่รันอยู่จะเห็น version เป็น null และรอ TTL แทน)
 */
describe('config-version · Redis จริง', () => {
  test('bump แล้วอ่านได้เลขที่มากขึ้น', async () => {
    const before = Number((await readConfigVersion('intents')) ?? '0');
    await bumpConfigVersion('intents');
    const after = await readConfigVersion('intents');
    expect(after).toMatch(/^\d+$/);
    // ไม่ assert ว่า +1 พอดี — ไฟล์ intents อื่นที่รันขนานกันก็ bump scope นี้ด้วย
    expect(Number(after)).toBeGreaterThan(before);
  });

  test('ค่าที่ readConfigVersion คืนตรงกับ GET ดิบ', async () => {
    // § ใช้ scope 'intents' เท่านั้น — vitest รันไฟล์ขนานกัน ถ้าไฟล์นี้ bump 'settings'
    // จะไปรบกวนเทสต์ TTL fallback ใน settings.integration.test.ts ที่ต้องการให้ version นิ่ง
    await bumpConfigVersion('intents');
    const raw = await redis.get<string | number>(configVersionKey('intents'));
    expect(await readConfigVersion('intents')).toBe(String(raw));
  });
});
