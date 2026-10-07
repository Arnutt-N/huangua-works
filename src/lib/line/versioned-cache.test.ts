import { describe, expect, it, vi } from 'vitest';
import { createVersionedCache } from './versioned-cache';

function setup(initialVersion: string | null = '1') {
  let clock = 1_000_000;
  let version: string | null = initialVersion;
  let loads = 0;
  const readVersion = vi.fn(async () => version);
  const cache = createVersionedCache<number>({
    load: async () => {
      loads += 1;
      return loads;
    },
    readVersion,
    ttlMs: 60_000,
    versionCheckMs: 3_000,
    now: () => clock,
  });
  return {
    cache,
    readVersion,
    advance: (ms: number) => {
      clock += ms;
    },
    setVersion: (next: string | null) => {
      version = next;
    },
    loadCount: () => loads,
  };
}

describe('createVersionedCache', () => {
  it('โหลดครั้งแรก แล้วตอบจาก memory โดยไม่ถาม Redis ภายใน versionCheckMs', async () => {
    const t = setup();
    expect(await t.cache.get()).toBe(1);
    t.advance(2_999);
    expect(await t.cache.get()).toBe(1);
    expect(t.loadCount()).toBe(1);
    expect(t.readVersion).toHaveBeenCalledTimes(1); // ครั้งเดียวตอนโหลด
  });

  it('ครบรอบเช็คแล้ว version เดิม → ไม่โหลดใหม่', async () => {
    const t = setup();
    await t.cache.get();
    t.advance(3_000);
    expect(await t.cache.get()).toBe(1);
    expect(t.loadCount()).toBe(1);
    expect(t.readVersion).toHaveBeenCalledTimes(2);
  });

  it('version เปลี่ยน → โหลดใหม่', async () => {
    const t = setup();
    await t.cache.get();
    t.setVersion('2');
    t.advance(3_000);
    expect(await t.cache.get()).toBe(2);
  });

  it('หลังเช็คแล้วไม่ถาม Redis ซ้ำจนครบรอบใหม่', async () => {
    const t = setup();
    await t.cache.get();
    t.advance(3_000);
    await t.cache.get();
    t.advance(1_000);
    await t.cache.get();
    expect(t.readVersion).toHaveBeenCalledTimes(2);
  });

  it('Redis ล่ม (version = null) → ใช้ค่าเดิมจนครบ TTL แล้วจึงโหลดใหม่', async () => {
    const t = setup();
    await t.cache.get();
    t.setVersion(null);
    t.advance(3_000);
    expect(await t.cache.get()).toBe(1);
    t.advance(57_000); // รวม 60_000 นับจากโหลด
    expect(await t.cache.get()).toBe(2);
  });

  it('โหลดตอน Redis ยังไม่มี key แล้วภายหลังมีเลข version → โหลดใหม่', async () => {
    const t = setup(null);
    await t.cache.get();
    t.setVersion('5');
    t.advance(3_000);
    expect(await t.cache.get()).toBe(2);
  });

  it('invalidate() → get ครั้งถัดไปโหลดใหม่ทันที', async () => {
    const t = setup();
    await t.cache.get();
    t.cache.invalidate();
    expect(await t.cache.get()).toBe(2);
  });

  it('§ writer แทรกกลาง await ของ reload เก่า → ค่าใหม่ไม่ถูกเขียนทับ', async () => {
    let releaseFirst!: () => void;
    const firstLoad = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let loads = 0;
    const cache = createVersionedCache<number>({
      // § คืน snapshot ของครั้งตัวเอง — ถ้าคืน shared counter ตรง ๆ ค่าที่ stale get ได้
      // จะเป็น 2 (ถูก increment ครั้งที่สองไปแล้ว) ไม่ใช่ 1 และไม่มี implementation ไหนผ่านได้
      load: async () => {
        loads += 1;
        const n = loads;
        if (n === 1) await firstLoad;
        return n;
      },
      readVersion: async () => String(loads),
      ttlMs: 60_000,
      versionCheckMs: 3_000,
      now: () => 0,
    });

    const stale = cache.get();
    await vi.waitFor(() => expect(loads).toBe(1));
    cache.invalidate();
    await expect(cache.get()).resolves.toBe(2);
    releaseFirst();
    await expect(stale).resolves.toBe(1);
    await expect(cache.get()).resolves.toBe(2);
  });

  it('load พัง → error ส่งต่อถึงผู้เรียก และครั้งถัดไปลองโหลดใหม่', async () => {
    let attempt = 0;
    const cache = createVersionedCache<string>({
      load: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('db down');
        return 'ok';
      },
      readVersion: async () => '1',
      ttlMs: 60_000,
      versionCheckMs: 3_000,
      now: () => 0,
    });
    await expect(cache.get()).rejects.toThrow('db down');
    await expect(cache.get()).resolves.toBe('ok');
  });
});
