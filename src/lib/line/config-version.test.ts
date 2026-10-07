import { afterEach, describe, expect, it, vi } from 'vitest';

const redisMock = vi.hoisted(() => ({ get: vi.fn(), incr: vi.fn() }));
vi.mock('@/lib/upstash', () => ({ redis: redisMock }));

// § module อ่าน env ตอน load (เหมือน sse/broadcaster.ts) จึงต้อง reset แล้ว import ใหม่ทุกเคส
async function loadModule(redisConfigured: boolean) {
  vi.resetModules();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', redisConfigured ? 'http://redis.test' : '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', redisConfigured ? 'unit-test-token-xx' : '');
  return import('./config-version');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  redisMock.get.mockReset();
  redisMock.incr.mockReset();
});

describe('config-version', () => {
  it('key แยกตาม scope', async () => {
    const mod = await loadModule(true);
    expect(mod.configVersionKey('settings')).toBe('bot-config:version:settings');
    expect(mod.configVersionKey('intents')).toBe('bot-config:version:intents');
  });

  it('อ่านเลข version เป็น string (Upstash คืนตัวเลขหลัง INCR)', async () => {
    const mod = await loadModule(true);
    redisMock.get.mockResolvedValue(7);
    await expect(mod.readConfigVersion('settings')).resolves.toBe('7');
    expect(redisMock.get).toHaveBeenCalledWith('bot-config:version:settings');
  });

  it('ยังไม่มี key → null', async () => {
    const mod = await loadModule(true);
    redisMock.get.mockResolvedValue(null);
    await expect(mod.readConfigVersion('intents')).resolves.toBeNull();
  });

  it('Redis error → null (ไม่ throw)', async () => {
    const mod = await loadModule(true);
    redisMock.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(mod.readConfigVersion('settings')).resolves.toBeNull();
  });

  it('§ Redis ค้างเกิน 500ms → null ไม่ถ่วงการตอบ webhook', async () => {
    const mod = await loadModule(true);
    vi.useFakeTimers();
    redisMock.get.mockReturnValue(new Promise(() => {}));
    const pending = mod.readConfigVersion('settings');
    await vi.advanceTimersByTimeAsync(500);
    await expect(pending).resolves.toBeNull();
  });

  it('ไม่มี env Upstash → ไม่เรียก Redis เลย', async () => {
    const mod = await loadModule(false);
    await expect(mod.readConfigVersion('settings')).resolves.toBeNull();
    await mod.bumpConfigVersion('settings');
    expect(redisMock.get).not.toHaveBeenCalled();
    expect(redisMock.incr).not.toHaveBeenCalled();
  });

  it('bump เรียก INCR และกลืน error (การเขียนลง DB สำเร็จไปแล้ว)', async () => {
    const mod = await loadModule(true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    redisMock.incr.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(mod.bumpConfigVersion('intents')).resolves.toBeUndefined();
    expect(redisMock.incr).toHaveBeenCalledWith('bot-config:version:intents');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
