import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Redis bridge ของ SSE — Upstash ไม่ยิง 'error' ตอน stream ขาด (อ่านใน IIFE แยก)
 * ล็อกว่า watchdog (loopback ping) ต่อใหม่เองโดยไม่ต้องรอ client ใหม่ และไม่ deliver ซ้ำ
 */

const HEARTBEAT_MS = 30_000;

const { fake, mockSubscribe, mockPublish } = vi.hoisted(() => {
  type Handler = (payload: unknown) => void;
  class FakeSub {
    handlers = new Map<string, Handler>();
    unsubscribe = vi.fn(async () => undefined);
    removeAllListeners = vi.fn(() => this.handlers.clear());
    on(type: string, fn: Handler) {
      this.handlers.set(type, fn);
    }
    emit(type: string, payload: unknown) {
      this.handlers.get(type)?.(payload);
    }
  }
  const fake = { subs: [] as FakeSub[], echo: true };
  const mockSubscribe = vi.fn(() => {
    const sub = new FakeSub();
    fake.subs.push(sub);
    return sub;
  });
  // § echo แบบ synchronous ก่อน await ใด ๆ — จำลอง Redis ส่ง publish กลับหา subscriber ตัวล่าสุด
  const mockPublish = vi.fn((_channel: string, payload: string) => {
    if (fake.echo) fake.subs.at(-1)?.emit('message', { message: JSON.parse(payload) });
    return Promise.resolve(1);
  });
  return { fake, mockSubscribe, mockPublish };
});

vi.mock('@/lib/upstash', () => ({ redis: { subscribe: mockSubscribe, publish: mockPublish } }));

let mod: typeof import('./broadcaster');

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'http://fake-upstash');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token-0123456789');
  vi.resetModules();
  fake.subs = [];
  fake.echo = true;
  mockSubscribe.mockClear();
  mockPublish.mockClear();
  mod = await import('./broadcaster');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function subAt(i: number) {
  const sub = fake.subs[i];
  if (!sub) throw new Error(`ไม่มี subscriber ลำดับ ${i}`);
  return sub;
}

function otherOriginEvent() {
  return { type: 'new_message', conversationId: 'c', payload: {}, _origin: 'other-process' };
}

describe('broadcaster · Redis subscriber lifecycle', () => {
  it('เปิด subscriber ครั้งเดียวแม้มีหลาย client', () => {
    mod.subscribe(vi.fn());
    mod.subscribe(vi.fn());
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it("'error' → ปิดตัวเก่า แล้วต่อใหม่รอบ heartbeat ถัดไปโดยไม่ต้องมี client ใหม่", () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mod.subscribe(vi.fn());

    subAt(0).emit('error', new Error('connect failed'));
    expect(subAt(0).unsubscribe).toHaveBeenCalled();

    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(fake.subs).toHaveLength(2);
  });

  it('stream ตายเงียบ (ไม่มี loopback) → ต่อใหม่ภายใน 3 heartbeat', () => {
    fake.echo = false;
    mod.subscribe(vi.fn());

    vi.advanceTimersByTime(HEARTBEAT_MS * 3);

    expect(fake.subs).toHaveLength(2);
    expect(subAt(0).unsubscribe).toHaveBeenCalled();
  });

  it('loopback ping มาตามปกติ → ไม่ต่อใหม่', () => {
    mod.subscribe(vi.fn());
    vi.advanceTimersByTime(HEARTBEAT_MS * 10);
    expect(fake.subs).toHaveLength(1);
  });

  it('subscriber เก่าหลังถูกแทนไม่ deliver ซ้ำ', () => {
    fake.echo = false;
    const listener = vi.fn();
    mod.subscribe(listener);
    vi.advanceTimersByTime(HEARTBEAT_MS * 3);

    subAt(0).emit('message', { message: otherOriginEvent() });
    expect(listener).not.toHaveBeenCalled();

    subAt(1).emit('message', { message: otherOriginEvent() });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ type: 'new_message', conversationId: 'c', payload: {} });
  });

  it('ping จาก process อื่นไม่ถึง listener', () => {
    const listener = vi.fn();
    mod.subscribe(listener);
    subAt(0).emit('message', { message: { type: 'ping', _origin: 'other-process' } });
    expect(listener).not.toHaveBeenCalled();
  });

  it('ไม่มี listener แล้ว → หยุด subscriber และ heartbeat', () => {
    const unsubscribe = mod.subscribe(vi.fn());
    unsubscribe();

    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(subAt(0).unsubscribe).toHaveBeenCalled();

    const publishes = mockPublish.mock.calls.length;
    vi.advanceTimersByTime(HEARTBEAT_MS * 4);
    expect(mockPublish.mock.calls.length).toBe(publishes);
  });

  it('20 SSE client พร้อมกันไม่เตือน MaxListenersExceeded (เพดานไม่ใช่ default 10)', () => {
    const emitWarning = vi.spyOn(process, 'emitWarning');
    for (let i = 0; i < 20; i++) mod.subscribe(vi.fn());
    expect(
      emitWarning.mock.calls.some(([w]) => (w as Error | undefined)?.name === 'MaxListenersExceededWarning'),
    ).toBe(false);
  });
});
