import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store, redisMock } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const redisMock = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, opts?: { ex?: number }) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
  };
  return { store, redisMock };
});

vi.mock('@/lib/upstash', () => ({
  redis: redisMock,
}));

const { withLineCircuit } = await import('./circuit-breaker');

const ok = async () => 'ok';
const boom = async () => {
  throw new Error('LINE down');
};

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('withLineCircuit · ปิดวงจรปกติ', () => {
  it('สำเร็จ → คืนค่าตรง ไม่แตะ state ผิด', async () => {
    await expect(withLineCircuit('/message/reply', ok)).resolves.toBe('ok');
    expect(store.has('line:circuit:/message/reply:open')).toBe(false);
  });
});

describe('withLineCircuit · เปิดวงจรเมื่อล้มติดกัน', () => {
  it('ล้ม 5 ครั้งติด → ครั้งที่ 6 fast-fail ไม่เรียก fn', async () => {
    const fn = vi.fn(boom);
    for (let i = 0; i < 5; i++) {
      await expect(withLineCircuit('/message/push', fn)).rejects.toThrow('LINE down');
    }
    expect(fn).toHaveBeenCalledTimes(5);

    await expect(withLineCircuit('/message/push', fn)).rejects.toThrow('LINE API circuit is open');
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('สำเร็จคั่นกลาง → reset ตัวนับ', async () => {
    const flaky = vi.fn(async () => {
      if (flaky.mock.calls.length < 4) throw new Error('flaky');
      return 'ok';
    });
    for (let i = 0; i < 3; i++) {
      await expect(withLineCircuit('/x', flaky)).rejects.toThrow('flaky');
    }
    await expect(withLineCircuit('/x', flaky)).resolves.toBe('ok');
    // ตัวนับ reset แล้ว — ล้มอีก 3 ไม่ควรเปิด
    for (let i = 0; i < 3; i++) {
      await expect(withLineCircuit('/x', flaky)).resolves.toBe('ok');
    }
  });
});

describe('withLineCircuit · Redis ล่ม', () => {
  it('fail-open: ยิง fn ตรงเหมือนเดิม', async () => {
    redisMock.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(withLineCircuit('/message/reply', ok)).resolves.toBe('ok');
  });
});
