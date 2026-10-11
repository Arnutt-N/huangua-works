import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnforce, mockVerify, mockHandle } = vi.hoisted(() => ({
  mockEnforce: vi.fn(),
  mockVerify: vi.fn(),
  mockHandle: vi.fn(),
}));

vi.mock('@/lib/rate-limit/enforce', () => ({
  enforceRateLimit: mockEnforce,
}));

vi.mock('@/lib/line/signature', () => ({
  verifyLineSignature: mockVerify,
}));

vi.mock('@/lib/line/bot/engine', () => ({
  handleEvent: mockHandle,
}));

vi.mock('@/lib/upstash', () => {
  // § mock จำ state แบบ Redis SET NX — key เดิมคืน null (ถือว่าซ้ำ)
  const seen = new Set<string>();
  return {
    redis: {
      set: vi.fn(async (key: string) => {
        if (seen.has(key)) return null;
        seen.add(key);
        return 'OK';
      }),
      get: vi.fn(async () => null),
      del: vi.fn(async () => 1),
      eval: vi.fn(async () => 1),
    },
  };
});

import { redis } from '@/lib/upstash';

const { POST } = await import('./route');

function webhookRequest(body: unknown, ip = '203.0.113.5'): Request {
  return new Request('http://localhost/api/line/webhook', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

const BODY = { destination: 'U1', events: [{ type: 'follow', webhookEventId: 'w1' }] };

beforeEach(() => {
  vi.clearAllMocks();
  mockVerify.mockReturnValue(true);
  mockHandle.mockResolvedValue(undefined);
});

describe('POST /api/line/webhook · rate limit', () => {
  it('เกิน limit → 429 + Retry-After และไม่ประมวลผล event', async () => {
    mockEnforce.mockResolvedValue({ allowed: false, remaining: 0, reset: 42 });

    const res = await POST(webhookRequest(BODY));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(mockEnforce).toHaveBeenCalledWith('lineWebhookIp', '203.0.113.5');
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it('ผ่าน limit → 200 และประมวลผล event', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });

    const res = await POST(webhookRequest(BODY));

    expect(res.status).toBe(200);
    expect(mockHandle).toHaveBeenCalledTimes(1);
  });

  it('ลายเซ็นไม่ผ่าน → 401 ก่อนเช็ก rate limit', async () => {
    mockVerify.mockReturnValue(false);

    const res = await POST(webhookRequest(BODY));

    expect(res.status).toBe(401);
    expect(mockEnforce).not.toHaveBeenCalled();
  });
});

describe('POST /api/line/webhook · dedup', () => {
  const msgEvent = (webhookEventId: string, lineId: string) => ({
    destination: 'U1',
    events: [{ type: 'message', webhookEventId, message: { type: 'text', id: lineId, text: 'hi' } }],
  });

  it('event ซ้ำ (webhookEventId เดิม) → ข้ามไม่ประมวลผลซ้ำ', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });

    await POST(webhookRequest(msgEvent('w-dup', 'm-1')));
    await POST(webhookRequest(msgEvent('w-dup', 'm-2')));

    expect(mockHandle).toHaveBeenCalledTimes(1);
  });

  it('redelivery (line message id เดิม ต่าง webhookEventId) → ข้าม', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });

    await POST(webhookRequest(msgEvent('w-1', 'm-same')));
    await POST(webhookRequest(msgEvent('w-2', 'm-same')));

    expect(mockHandle).toHaveBeenCalledTimes(1);
  });

  it('คนละ event คนละ message → ประมวลผลทั้งคู่', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });
    const before = mockHandle.mock.calls.length;

    await POST(webhookRequest(msgEvent('w-fresh-1', 'm-fresh-1')));
    await POST(webhookRequest(msgEvent('w-fresh-2', 'm-fresh-2')));

    expect(mockHandle.mock.calls.length - before).toBe(2);
  });

  it('Redis ล่ม → fail-open ประมวลผลต่อ', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });
    vi.mocked(redis.set).mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await POST(webhookRequest(BODY));

    expect(res.status).toBe(200);
    expect(mockHandle).toHaveBeenCalled();
  });
});
