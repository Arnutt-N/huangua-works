import { afterEach, describe, expect, it, vi } from 'vitest';
import { Redis } from '@upstash/redis';

/**
 * สัญญา Upstash SDK ตัวติดตั้งจริง (PR #118 blast proof) — unsubscribe ตัด stream
 * เก่าทิ้งจริง และ stream จบเงียบโดยไม่มี error event จึงต้องมี watchdog
 */

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('PR118 สัญญา Upstash SDK ที่ติดตั้งจริง', () => {
  it('อ่าน wire message จริงและ unsubscribe abort พร้อมล้าง listeners', async () => {
    let writer: ReadableStreamDefaultController | undefined;
    let signal: AbortSignal | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, options) => {
      signal = (options as { signal?: AbortSignal }).signal;
      return new Response(
        new ReadableStream({
          start(controller) {
            writer = controller;
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      );
    });
    const redis = new Redis({ url: 'https://proof.invalid', token: 'synthetic-only', enableAutoPipelining: false });
    const sub = redis.subscribe('proof-channel');
    const message = vi.fn();
    sub.on('message', message);
    await vi.waitFor(() => expect(writer).toBeDefined());
    writer!.enqueue(new TextEncoder().encode('data: message,proof-channel,{"type":"new_message","_origin":"other"}\n'));
    await vi.waitFor(() => expect(message).toHaveBeenCalledTimes(1));
    expect(message).toHaveBeenCalledWith({
      channel: 'proof-channel',
      message: { type: 'new_message', _origin: 'other' },
    });
    sub.removeAllListeners();
    await sub.unsubscribe();
    expect(signal!.aborted).toBe(true);
    expect(sub.getSubscribedChannels()).toEqual([]);
    writer!.enqueue(new TextEncoder().encode('data: message,proof-channel,{"type":"new_message","_origin":"other"}\n'));
    writer!.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(message).toHaveBeenCalledTimes(1);
  });

  it('stream จบเงียบไม่ส่ง error event จึงต้องใช้ watchdog', async () => {
    let writer: ReadableStreamDefaultController | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              writer = controller;
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    );
    const redis = new Redis({ url: 'https://proof.invalid', token: 'synthetic-only', enableAutoPipelining: false });
    const sub = redis.subscribe('proof-channel');
    const error = vi.fn();
    sub.on('error', error);
    await vi.waitFor(() => expect(writer).toBeDefined());
    writer!.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(error).not.toHaveBeenCalled();
    await sub.unsubscribe();
  });
});
