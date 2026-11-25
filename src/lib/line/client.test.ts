import { describe, expect, it, vi } from 'vitest';
import { LineApiError } from './client';

const { circuitMock } = vi.hoisted(() => ({
  circuitMock: vi.fn(async (_endpoint: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('./circuit-breaker', () => ({
  withLineCircuit: circuitMock,
  LineCircuitOpenError: class LineCircuitOpenError extends Error {},
}));

function lineResponse(status: number, init?: { headers?: Record<string, string> }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(init?.headers ?? {}),
    text: async () => '',
  } as Response;
}

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;
function mockFetch(responder: () => Response): FetchMock {
  const fn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => responder()) as unknown as FetchMock;
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('LINE client · retry key และ timeout เฉพาะ broadcast/multicast', () => {
  it('broadcast ส่ง header X-Line-Retry-Key รูป UUID และ signal ไม่ถูก abort', async () => {
    const fetchMock = mockFetch(() => lineResponse(200));
    const { broadcastMessage } = await import('./client');

    await broadcastMessage([{ type: 'text', text: 'สวัสดี' }], '11111111-1111-5111-8111-111111111111');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Line-Retry-Key']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((init.signal as AbortSignal).aborted).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('multicast ส่ง retry key เดิมทุกครั้งที่เรียก retry', async () => {
    const fetchMock = mockFetch(() => lineResponse(200));
    const { multicast } = await import('./client');
    const key = '22222222-2222-5222-8222-222222222222';

    await multicast(['U1'], [{ type: 'text', text: 'สวัสดี' }], key);
    await multicast(['U1'], [{ type: 'text', text: 'สวัสดี' }], key);

    const headers = fetchMock.mock.calls.map((call) => (call[1] as RequestInit).headers as Record<string, string>);
    expect(headers[0]?.['X-Line-Retry-Key']).toBe(key);
    expect(headers[1]?.['X-Line-Retry-Key']).toBe(key);
  });

  it('post endpoint อื่นไม่มี retry key และไม่มี timeout', async () => {
    const fetchMock = mockFetch(() => lineResponse(200));
    const { replyMessage } = await import('./client');

    await replyMessage('reply-1', [{ type: 'text', text: 'สวัสดี' }]);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Line-Retry-Key']).toBeUndefined();
    expect(init.signal).toBeUndefined();
  });

  it('409 พร้อม accepted request id ถือเป็นสำเร็จ', async () => {
    const fetchMock = mockFetch(() =>
      lineResponse(409, { headers: { 'x-line-accepted-request-id': 'req-123' } }),
    );
    const { broadcastMessage } = await import('./client');

    await expect(
      broadcastMessage([{ type: 'text', text: 'สวัสดี' }], '33333333-3333-5333-8333-333333333333'),
    ).resolves.toBeUndefined();
  });

  it('409 ไม่มี accepted request id → โยน LineApiError status 409', async () => {
    const fetchMock = mockFetch(() => lineResponse(409));
    const { broadcastMessage } = await import('./client');

    await expect(
      broadcastMessage([{ type: 'text', text: 'สวัสดี' }], '44444444-4444-5444-8444-444444444444'),
    ).rejects.toMatchObject({ name: 'LineApiError', status: 409 } satisfies Partial<LineApiError>);
  });
});

describe('LineApiError · Retry-After เฉพาะ 429', () => {
  async function failure(status: number, headers?: Record<string, string>): Promise<unknown> {
    mockFetch(() => lineResponse(status, { headers }));
    const { broadcastMessage } = await import('./client');
    return broadcastMessage([{ type: 'text', text: 'สวัสดี' }], '55555555-5555-5555-8555-555555555555')
      .then(() => null)
      .catch((error: unknown) => error);
  }

  it('429 พร้อม Retry-After 42 วิ → retryAfterMs 42000', async () => {
    await expect(failure(429, { 'Retry-After': '42' })).resolves.toMatchObject({
      name: 'LineApiError',
      status: 429,
      retryAfterMs: 42000,
    } satisfies Partial<LineApiError>);
  });

  it('429 พร้อม Retry-After 99999 วิ → clamp ที่ 60000 ms', async () => {
    await expect(failure(429, { 'Retry-After': '99999' })).resolves.toMatchObject({
      name: 'LineApiError',
      status: 429,
      retryAfterMs: 60000,
    } satisfies Partial<LineApiError>);
  });

  it('429 ไม่มี Retry-After → retryAfterMs ไม่กำหนด', async () => {
    const error = await failure(429);
    expect(error).toBeInstanceOf(LineApiError);
    expect((error as LineApiError).retryAfterMs).toBeUndefined();
  });

  it('500 พร้อม Retry-After → ไม่แปลงเป็น retryAfterMs', async () => {
    const error = await failure(500, { 'Retry-After': '42' });
    expect(error).toBeInstanceOf(LineApiError);
    expect((error as LineApiError).retryAfterMs).toBeUndefined();
  });
});
