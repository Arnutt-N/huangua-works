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

vi.mock('@/lib/upstash', () => ({
  redis: { set: vi.fn(async () => 'OK') },
}));

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
