/**
 * cache ใน memory ที่ "เห็นการเขียนจาก process อื่น" ผ่านเลข version ภายนอก (Redis)
 *
 * - ภายใน versionCheckMs หลังเช็คล่าสุด → ตอบจาก memory ไม่แตะ Redis (ไม่เพิ่ม latency ต่อข้อความ)
 * - ครบรอบ → อ่าน version; ถ้าต่างจากตอนโหลด → โหลดใหม่
 * - อ่าน version ไม่ได้ (null) → ใช้ค่าเดิมจนครบ ttlMs (พฤติกรรมเดิมก่อนมี version)
 *
 * pure: ไม่ import อะไร — ผู้เรียก inject load/readVersion/now เพื่อให้ test คุมได้ทั้งหมด
 */

export const BOT_CONFIG_TTL_MS = 60_000;
export const BOT_CONFIG_VERSION_CHECK_MS = 3_000;

export interface VersionedCacheOptions<T> {
  load: () => Promise<T>;
  readVersion: () => Promise<string | null>;
  ttlMs: number;
  versionCheckMs: number;
  now?: () => number;
}

export interface VersionedCache<T> {
  get(): Promise<T>;
  invalidate(): void;
}

interface Entry<T> {
  value: T;
  loadedAt: number;
  checkedAt: number;
  version: string | null;
}

export function createVersionedCache<T>(opts: VersionedCacheOptions<T>): VersionedCache<T> {
  // § ต้องเป็น arrow ที่อ่าน Date.now ตอนเรียก ไม่ใช่เก็บ reference `Date.now` ไว้ตอนสร้าง —
  // integration test ใช้ vi.useFakeTimers({ toFake: ['Date'] }) ซึ่งสลับ global Date ภายหลัง
  const now = opts.now ?? (() => Date.now());
  let entry: Entry<T> | null = null;
  let generation = 0;

  async function reload(): Promise<T> {
    // § อ่าน version "ก่อน" load — ถ้ามีคนเขียนแทรกระหว่าง load เราจะถือ version เก่า
    // แล้วรอบเช็คถัดไปจะเห็นว่าเปลี่ยนและโหลดใหม่ ถ้าสลับลำดับจะพลาดการเขียนนั้นจนครบ TTL
    const ticket = ++generation;
    const version = await opts.readVersion();
    const value = await opts.load();
    // § generation/in-flight: writer ที่ invalidate หรือ reload ใหม่กว่าแทรกกลาง await
    // ต้องทิ้งผลนี้ ห้ามเขียน entry ทับค่าที่ใหม่กว่า
    if (ticket !== generation) return value;
    const at = now();
    entry = { value, loadedAt: at, checkedAt: at, version };
    return value;
  }

  return {
    async get() {
      const current = entry;
      if (!current || now() - current.loadedAt >= opts.ttlMs) return reload();
      if (now() - current.checkedAt < opts.versionCheckMs) return current.value;

      const ticket = generation;
      const version = await opts.readVersion();
      // invalidate/reload แทรกระหว่าง await — อย่าฟื้นค่าเก่าด้วยการเขียน checkedAt ทับ
      if (ticket !== generation || entry !== current) return reload();
      if (version !== null && version !== current.version) return reload();

      entry = { ...current, checkedAt: now() };
      return current.value;
    },
    invalidate() {
      generation += 1;
      entry = null;
    },
  };
}
