import { afterEach, describe, expect, test } from 'vitest';
import { checkRateLimit, redis } from './upstash';

/**
 * Integration test — ต้องมี Redis stack รันอยู่จริง
 * (`docker compose up -d redis up-redis`) คุยกับ Redis ของจริงผ่าน up-redis REST proxy
 * ไม่ mock
 *
 * § ทำไมต้องมีไฟล์นี้ทั้งที่มี upstash.test.ts อยู่แล้ว
 *
 * unit test ใช้ mock ที่ "เขียน zrank เอง" จึงผ่านโดยนิยาม — มันพิสูจน์ได้แค่ว่า mock
 * ตรงกับความคาดหวังของคนเขียน ไม่ได้พิสูจน์ว่า Redis จริงเรียงลำดับแบบนั้น
 * ข้อสรุปทั้งหมดของ checkRateLimit วางอยู่บนพฤติกรรมของ ZRANK ที่ว่า
 * "คืนลำดับของ member ในเซ็ตที่เรียงตาม score แล้วตามด้วย member แบบ lexicographic"
 * ถ้าสมมติฐานนี้ผิด (หรือ proxy/Upstash ไม่รองรับ ZRANK) unit test จะยังเขียวสนิท
 * แต่ของจริงจะพังแบบเงียบ ๆ:
 *   - path ที่ failOpen (public) → ปล่อยผ่านทุก request = rate limit หายไปทั้งระบบ
 *   - path ที่ failOpen: false (login/reset) → ปฏิเสธทุก request = login พังทั้งระบบ
 * ทั้งสองกรณีดังแค่ console.warn บรรทัดเดียว ไฟล์นี้จึงเป็นด่านเดียวที่จับได้
 */

// key แยกตามรอบรัน ไม่ให้ state ค้างข้ามการรันซ้ำ
const RUN_SEED = `${Date.now()}-${process.pid}`;
const usedKeys: string[] = [];

function testKey(label: string): string {
  const key = `test:ratelimit:${RUN_SEED}:${label}`;
  usedKeys.push(key);
  return key;
}

afterEach(async () => {
  // ลบ key ที่สร้างไว้ ไม่ให้ค้างใน Redis ของ dev
  await Promise.all(usedKeys.splice(0).map((k) => redis.del(k)));
});

describe('checkRateLimit · ZRANK ทำงานจริงผ่าน proxy', () => {
  test('คำสั่ง ZRANK รองรับ และคืน null เมื่อไม่มี member นั้น', async () => {
    // § ข้อสมมติฐานหลักของ checkRateLimit — ถ้าข้อนี้พังทุกอย่างข้างล่างไม่มีความหมาย
    const key = testKey('zrank-contract');
    await redis.zadd(key, { score: 1, member: 'a' }, { score: 2, member: 'b' });

    await expect(redis.zrank(key, 'a')).resolves.toBe(0);
    await expect(redis.zrank(key, 'b')).resolves.toBe(1);
    await expect(redis.zrank(key, 'ไม่มีอยู่')).resolves.toBeNull();
  });

  test('เรียง member แบบ lexicographic เมื่อ score เท่ากัน — เป็นเคสจริงของ request ในมิลลิวินาทีเดียวกัน', async () => {
    const key = testKey('zrank-ties');
    await redis.zadd(
      key,
      { score: 100, member: '100-0.9' },
      { score: 100, member: '100-0.1' },
      { score: 100, member: '100-0.5' },
    );

    await expect(redis.zrank(key, '100-0.1')).resolves.toBe(0);
    await expect(redis.zrank(key, '100-0.5')).resolves.toBe(1);
    await expect(redis.zrank(key, '100-0.9')).resolves.toBe(2);
  });
});

describe('checkRateLimit · การนับตามลำดับ (Redis จริง)', () => {
  test('ปล่อยผ่านครบตาม limit แล้วปฏิเสธตัวถัดไป', async () => {
    const key = testKey('sequential');
    const seq: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      seq.push((await checkRateLimit(key, 3, 60)).allowed);
    }

    expect(seq).toEqual([true, true, true, false, false]);
  });

  test('remaining นับถอยหลังถูกต้อง และตัวที่ชนขอบ limit พอดียังผ่าน', async () => {
    const key = testKey('remaining');
    const first = await checkRateLimit(key, 3, 60);
    const second = await checkRateLimit(key, 3, 60);
    const third = await checkRateLimit(key, 3, 60);

    expect([first.remaining, second.remaining, third.remaining]).toEqual([2, 1, 0]);
    expect(third.allowed).toBe(true);
  });

  test('รายการที่หลุดหน้าต่างเวลาถูกตัดออกก่อนตัดสิน', async () => {
    const key = testKey('window');
    // ใส่รายการเก่าที่หลุดหน้าต่าง 60 วินาทีไปแล้ว
    const stale = Date.now() - 120_000;
    await redis.zadd(
      key,
      { score: stale, member: `${stale}-a` },
      { score: stale, member: `${stale}-b` },
      { score: stale, member: `${stale}-c` },
    );

    const result = await checkRateLimit(key, 3, 60);
    expect(result.allowed).toBe(true);
  });
});

describe('checkRateLimit · การยิงพร้อมกัน (จุดที่ unit test พิสูจน์ไม่ได้)', () => {
  test.each([
    ['limit 3 / 20 concurrent', 3, 20],
    ['limit 5 / 50 concurrent', 5, 50],
    ['limit 1 / 10 concurrent', 1, 10],
  ])('%s → ผ่านพอดี limit ไม่มากไม่น้อย', async (_label, limit, concurrent) => {
    const key = testKey(`race-${limit}-${concurrent}`);
    const results = await Promise.all(
      Array.from({ length: concurrent }, () => checkRateLimit(key, limit, 60)),
    );

    const allowed = results.filter((r) => r.allowed);

    // § ลำดับ zcard → zadd (บั๊กเดิม) จะปล่อยผ่านเกือบทั้งหมดตรงนี้
    // ส่วน zadd → zcard จะปฏิเสธทั้งหมด เพราะทุกตัวเห็น count เท่ากับจำนวน request
    expect(allowed).toHaveLength(limit);

    // remaining ของตัวที่ผ่านต้องเป็น 0..limit-1 ครบทุกค่าไม่ซ้ำ
    // ถ้าซ้ำแปลว่า rank ชนกัน (member ซ้ำ) ซึ่งจะทำให้การนับเพี้ยนทั้งระบบ
    expect(allowed.map((r) => r.remaining).sort((a, b) => a - b)).toEqual(
      Array.from({ length: limit }, (_, i) => i),
    );
  });

  test('ยิงพร้อมกันพอดีเท่ากับ limit — ต้องผ่านทั้งหมด ไม่ปฏิเสธเกินจำเป็น', async () => {
    const key = testKey('race-exact');
    const results = await Promise.all(
      Array.from({ length: 3 }, () => checkRateLimit(key, 3, 60)),
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });

  test('request ที่ถูกปฏิเสธยังอยู่ในหน้าต่าง — ความพยายามที่ล้มเหลวนับรวมด้วย', async () => {
    // § พฤติกรรมนี้ตั้งใจ (กัน brute-force) ถ้ามีคนเปลี่ยนไป zrem ตัวที่ถูกปฏิเสธออก
    // เทสต์นี้จะจับได้
    const key = testKey('rejected-counted');
    for (let i = 0; i < 5; i++) await checkRateLimit(key, 2, 60);

    await expect(redis.zcard(key)).resolves.toBe(5);
  });
});

/**
 * § policy ตอน Redis ล่ม (failOpen true/false) อยู่ใน upstash.test.ts ไม่ใช่ที่นี่
 *
 * มันเป็น branch logic ล้วน ๆ ที่ mock คุมได้ตรงและเร็วกว่า ส่วนการจำลอง "Redis ล่ม"
 * ของจริงต้องสลับ client ที่ถูกสร้างตอน module load ซึ่งทำได้ยากและช้า (client retry
 * ใส่ host ที่ตายไปหลายวินาที) — เคยลองแล้วได้เทสต์ที่ทั้งช้าและเชื่อไม่ได้
 * ไฟล์นี้เก็บเฉพาะสิ่งที่ "ต้องใช้ Redis จริงเท่านั้นถึงพิสูจน์ได้"
 */
