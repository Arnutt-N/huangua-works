import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * checkRateLimit — regression test ของลำดับ zadd-ก่อน-zcard
 *
 * คอมเมนต์ในโค้ดเขียนว่า "ห้ามสลับกลับไปเป็น นับก่อน แล้วค่อยเพิ่ม" ซึ่งเป็นสัญญาณว่า
 * ต้องมีเทสต์คุ้ม ไม่ใช่พึ่งคอมเมนต์อย่างเดียว ลำดับเดิม (zcard → zadd) ไม่ atomic:
 * request ที่ยิงพร้อมกันอ่าน count ตัวเดียวกันก่อนที่ใครจะ zadd ทัน จึงผ่านได้ทั้งหมด
 *
 * mock จำลอง sorted set ในหน่วยความจำ โดยแต่ละ command เป็น async เพื่อให้ interleave
 * ได้จริงเหมือน REST round trip แยกกัน
 */

const { store, redisMock } = vi.hoisted(() => {
  const store = new Map<string, Array<{ member: string; score: number }>>();

  // § ทุก command หน่วง microtask หนึ่งจังหวะ เพื่อให้ Promise.all สลับลำดับกันได้จริง
  // ถ้าเป็น sync ล้วน การ interleave จะไม่เกิดและเทสต์จะไม่ได้ทดสอบอะไรเลย
  const tick = () => new Promise<void>((r) => setTimeout(r, 0));

  // Redis เรียงตาม score ก่อน แล้วค่อยเรียง member แบบ lexicographic เมื่อ score เท่ากัน
  const sorted = (set: Array<{ member: string; score: number }>) =>
    [...set].sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));

  const redisMock = {
    zremrangebyscore: vi.fn(async (key: string, min: number, max: number) => {
      await tick();
      const set = store.get(key) ?? [];
      store.set(
        key,
        set.filter((e) => e.score < min || e.score > max),
      );
    }),
    zcard: vi.fn(async (key: string) => {
      await tick();
      return (store.get(key) ?? []).length;
    }),
    zadd: vi.fn(async (key: string, entry: { score: number; member: string }) => {
      await tick();
      const set = store.get(key) ?? [];
      set.push({ member: entry.member, score: entry.score });
      store.set(key, set);
    }),
    zrank: vi.fn(async (key: string, member: string) => {
      await tick();
      const set = sorted(store.get(key) ?? []);
      const index = set.findIndex((e) => e.member === member);
      return index === -1 ? null : index;
    }),
    zrange: vi.fn(async (key: string) => {
      await tick();
      const oldest = sorted(store.get(key) ?? [])[0];
      return oldest ? [oldest.member, oldest.score] : [];
    }),
    expire: vi.fn(async () => {
      await tick();
    }),
  };

  return { store, redisMock };
});

vi.mock('@upstash/redis', () => ({
  Redis: class {
    zremrangebyscore = redisMock.zremrangebyscore;
    zcard = redisMock.zcard;
    zadd = redisMock.zadd;
    zrank = redisMock.zrank;
    zrange = redisMock.zrange;
    expire = redisMock.expire;
  },
}));

const { checkRateLimit } = await import('./upstash');

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('checkRateLimit · การนับตามลำดับ', () => {
  it('ปล่อยผ่านครบตามจำนวน limit แล้วปฏิเสธตัวถัดไป', async () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(await checkRateLimit('k:seq', 3, 60));
    }

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false, false]);
  });

  it('remaining นับถอยหลังถูกต้องจนถึงศูนย์', async () => {
    const first = await checkRateLimit('k:remaining', 3, 60);
    const second = await checkRateLimit('k:remaining', 3, 60);
    const third = await checkRateLimit('k:remaining', 3, 60);

    expect(first.remaining).toBe(2);
    expect(second.remaining).toBe(1);
    expect(third.remaining).toBe(0);
    // § ตัวที่ count เท่ากับ limit พอดีต้องยังผ่าน — ขอบเขตนี้พลาดง่ายตอนสลับเป็น zadd ก่อน
    expect(third.allowed).toBe(true);
  });

  it('ตัดรายการที่หลุดหน้าต่างเวลาออกก่อนนับ', async () => {
    store.set('k:window', [
      { member: 'old-1', score: Date.now() - 120_000 },
      { member: 'old-2', score: Date.now() - 120_000 },
      { member: 'old-3', score: Date.now() - 120_000 },
    ]);

    const result = await checkRateLimit('k:window', 3, 60);
    expect(result.allowed).toBe(true);
  });
});

describe('checkRateLimit · การยิงพร้อมกัน (จุดที่บั๊กเดิมอยู่)', () => {
  it.each([
    [3, 20],
    [5, 50],
    [1, 10],
  ])('ไม่ปล่อยเกิน limit=%i เมื่อยิงพร้อมกัน %i request', async (limit, concurrent) => {
    const results = await Promise.all(
      Array.from({ length: concurrent }, () => checkRateLimit('k:race', limit, 60)),
    );

    const allowed = results.filter((r) => r.allowed).length;
    // § ลำดับเดิม (zcard → zadd) จะปล่อยผ่านเกือบทั้งหมดตรงนี้
    // ส่วน zcard-หลัง-zadd จะปฏิเสธทั้งหมด (ทุกตัวเห็น count เท่ากับจำนวน request)
    // zrank ให้ผลที่ถูกต้องพอดี — ผ่านเท่ากับ limit เสมอ ไม่มากไม่น้อย
    expect(allowed).toBe(limit);
  });

  it('ยังทำงานถูกเมื่อยิงพร้อมกันพอดีเท่ากับ limit', async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, () => checkRateLimit('k:exact', 3, 60)),
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });
});

describe('checkRateLimit · policy ตอน Redis ล่ม', () => {
  beforeEach(() => {
    redisMock.zremrangebyscore.mockRejectedValueOnce(new Error('ECONNREFUSED'));
  });

  it('ปล่อยผ่านเมื่อ failOpen เป็น default (public path — บริการต้องไม่ล่มตาม Redis)', async () => {
    const result = await checkRateLimit('k:down', 3, 60);
    expect(result.allowed).toBe(true);
  });

  it('ปฏิเสธเมื่อ failOpen: false (auth path — Redis ล่มต้องไม่ถอด brute-force protection)', async () => {
    const result = await checkRateLimit('k:down', 3, 60, { failOpen: false });
    expect(result.allowed).toBe(false);
  });
});
