import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnforce, mockVerify, mockProcess, mockEnqueue, mockWarn } = vi.hoisted(() => ({
  mockWarn: vi.fn(),
  mockEnforce: vi.fn(),
  mockVerify: vi.fn(),
  mockProcess: vi.fn(),
  mockEnqueue: vi.fn(),
}));

vi.mock('@/lib/rate-limit/enforce', () => ({
  enforceRateLimit: mockEnforce,
}));

vi.mock('@/lib/line/signature', () => ({
  verifyLineSignature: mockVerify,
}));

vi.mock('@/lib/line/bot/engine', () => ({
  processWebhookEvents: mockProcess,
}));

vi.mock('@/lib/line/webhook-events', () => ({
  enqueueWebhookEvent: mockEnqueue,
}));

const { POST } = await import('./route');

function webhookRequest(body: unknown, ip = '203.0.113.5'): Request {
  return new Request('http://localhost/api/line/webhook', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

const NOW_MS = 1_795_651_200_000;
const followEvent = (id: string) => ({
  type: 'follow',
  webhookEventId: id,
  timestamp: NOW_MS,
  mode: 'active',
  source: { type: 'user', userId: 'U123' },
});
const BODY = { destination: 'U1', events: [followEvent('w1')] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(mockWarn);
  mockVerify.mockReturnValue(true);
  mockEnqueue.mockResolvedValue({ ok: true });
  mockProcess.mockResolvedValue({ attempted: 0, done: 0, retried: 0, failed: 0, deferred: 0 });
});

describe('POST /api/line/webhook · rate limit', () => {
  it('เกิน limit → 429 + Retry-After และไม่ประมวลผล event', async () => {
    mockEnforce.mockResolvedValue({ allowed: false, remaining: 0, reset: 42 });

    const res = await POST(webhookRequest(BODY));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(mockEnforce).toHaveBeenCalledWith('lineWebhookIp', '203.0.113.5');
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('ผ่าน limit → 200 และประมวลผล event', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });

    const res = await POST(webhookRequest(BODY));

    expect(res.status).toBe(200);
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
  });

  it('body เกิน 1 MiB → 413 ก่อนตรวจลายเซ็น', async () => {
    const big = new Uint8Array(1024 * 1024 + 1);
    const res = await POST(
      new Request('http://localhost/api/line/webhook', { method: 'POST', body: big }),
    );

    expect(res.status).toBe(413);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('ไบต์ที่ไม่ใช่ UTF-8 → 400 ก่อนตรวจลายเซ็น', async () => {
    const res = await POST(
      new Request('http://localhost/api/line/webhook', {
        method: 'POST',
        body: new Uint8Array([0xff]),
      }),
    );

    expect(res.status).toBe(400);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('body เกิน 1 MiB → 413 ก่อนตรวจลายเซ็น', async () => {
    const big = new Uint8Array(1024 * 1024 + 1);
    const res = await POST(
      new Request('http://localhost/api/line/webhook', { method: 'POST', body: big }),
    );

    expect(res.status).toBe(413);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('ไบต์ที่ไม่ใช่ UTF-8 → 400 ก่อนตรวจลายเซ็น', async () => {
    const res = await POST(
      new Request('http://localhost/api/line/webhook', {
        method: 'POST',
        body: new Uint8Array([0xff]),
      }),
    );

    expect(res.status).toBe(400);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('ลายเซ็นไม่ผ่าน → 401 ก่อนเช็ก rate limit', async () => {
    mockVerify.mockReturnValue(false);

    const res = await POST(webhookRequest(BODY));

    expect(res.status).toBe(401);
    expect(mockEnforce).not.toHaveBeenCalled();
  });

  it('JSON แตก → 400 (request ผิดรูป ไม่หลุดเป็น 500)', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });
    const bad = new Request('http://localhost/api/line/webhook', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.5' },
      body: 'not-json{{{',
    });

    const res = await POST(bad);

    expect(res.status).toBe(400);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it.each(['null', JSON.stringify({ events: 'x' })])('body %s → 400 (regression)', async (raw) => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });
    const res = await POST(
      new Request('http://localhost/api/line/webhook', { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.5' }, body: raw }),
    );
    expect(res.status).toBe(400);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('event นอกขอบเขตปนกับของจริง → 200, เก็บ/ประมวลผลตัวจริงตัวเดียว, นับ ignored', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });
    const supported = followEvent('w-mixed-ok');
    const unsupported = [
      null,
      { type: 'memberJoined', webhookEventId: 'w-join', timestamp: NOW_MS, source: { type: 'group', groupId: 'G1' } },
      { ...followEvent('w-no-user'), source: { type: 'user' } },
      { ...followEvent('w-bad-ts'), timestamp: 1.5 },
    ];

    const res = await POST(webhookRequest({ destination: 'U1', events: [unsupported[0], supported, ...unsupported.slice(1)] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ignored: unsupported.length });
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(supported);
    expect(mockProcess).toHaveBeenCalledWith(1);
    // § counter ต้อง bounded: ไม่ log payload (ข้อความร้องเรียน/PII)
    expect(JSON.stringify(mockWarn.mock.calls)).not.toContain('U123');
  });

  it('timestamp millisecond จริง (13 ตัว) ผ่าน boundary → ส่งเข้า enqueue', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });
    const event = followEvent('w-real-ts');

    const res = await POST(webhookRequest({ destination: 'U1', events: [event] }));

    expect(res.status).toBe(200);
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ timestamp: NOW_MS }));
  });

  it('message ที่มี webhookEventId เป็นตัวเลข → ignored (ไม่ให้ dedup key กลายเป็น w:42)', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });
    const bad = {
      type: 'message',
      webhookEventId: 42,
      timestamp: NOW_MS,
      mode: 'active',
      source: { type: 'user', userId: 'U123' },
      message: { type: 'text', id: 'm-1', text: 'สวัสดี' },
    };

    const res = await POST(webhookRequest({ destination: 'U1', events: [bad] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ignored: 1 });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('message text ไม่มี id → ignored (engine ต้องการ id ทุก subtype)', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });
    const bad = {
      type: 'message',
      timestamp: NOW_MS,
      mode: 'active',
      source: { type: 'user', userId: 'U123' },
      message: { type: 'text', text: 'สวัสดี' },
    };

    const res = await POST(webhookRequest({ destination: 'U1', events: [bad] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ignored: 1 });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('payload ไม่มี events array → 400', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });

    const res = await POST(webhookRequest({ destination: 'U1' }));

    expect(res.status).toBe(400);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

describe('POST /api/line/webhook · enqueue', () => {
  it('insert event ที่รองรับพัง → 500 (LINE จะ redeliver ทั้งชุด)', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });
    mockEnqueue.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: new Error('db down') });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await POST(webhookRequest({
      destination: 'U1',
      events: [followEvent('ok-1'), followEvent('bad-1')],
    }));

    expect(res.status).toBe(500);
  });

  it('insert ทั้งชุดสำเร็จ → 200 + process inline', async () => {
    mockEnforce.mockResolvedValue({ allowed: true, remaining: 59, reset: 60 });

    const res = await POST(webhookRequest({
      destination: 'U1',
      events: [followEvent('ok-1'), followEvent('ok-2')],
    }));

    expect(res.status).toBe(200);
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockProcess).toHaveBeenCalledWith(2);
  });
});
