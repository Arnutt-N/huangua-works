import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockEnforceRateLimit,
  mockVerifyLineIdToken,
  mockResolveCitizen,
  mockLogAudit,
  mockFindLineUserByRaw,
} = vi.hoisted(() => ({
  mockEnforceRateLimit: vi.fn(),
  mockVerifyLineIdToken: vi.fn(),
  mockResolveCitizen: vi.fn(),
  mockLogAudit: vi.fn(),
  mockFindLineUserByRaw: vi.fn(),
}));

vi.mock('@/lib/rate-limit/enforce', () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock('@/lib/liff/verify-line-id-token', () => ({
  verifyLineIdToken: mockVerifyLineIdToken,
}));

vi.mock('@/lib/cases/citizen-access', () => ({
  resolveCitizen: mockResolveCitizen,
}));

vi.mock('@/lib/audit', () => ({
  AUDIT_ACTIONS: { LIFF_LOGIN: 'liff_login' },
  logAudit: mockLogAudit,
}));

vi.mock('@/lib/line/identity', () => ({
  findLineUserByRaw: mockFindLineUserByRaw,
  lookupHash: (id: string) => `hash-${id}`,
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({})),
}));

import { createLiffSessionValue, LIFF_SESSION_COOKIE } from '@/lib/liff/session';
import { DELETE, GET, POST } from './route';

const TEST_KEY = 'a'.repeat(32);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CID_HMAC_KEY = TEST_KEY;
  mockEnforceRateLimit.mockResolvedValue({ allowed: true, reset: 60 });
});

describe('POST /api/liff/session', () => {
  it('rate limit เกิน → 429 พร้อมแจ้งเวลา reset', async () => {
    mockEnforceRateLimit.mockResolvedValueOnce({ allowed: false, reset: 45 });

    const req = new NextRequest('http://localhost/api/liff/session', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'valid.token' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('พยายามบ่อยเกินไป');
  });

  it('body ผิดรูปแบบ (ไม่มี idToken) → 400', async () => {
    const req = new NextRequest('http://localhost/api/liff/session', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('verifyLineIdToken ล้มเหลว → 401', async () => {
    mockVerifyLineIdToken.mockRejectedValueOnce(new Error('Invalid signature'));

    const req = new NextRequest('http://localhost/api/liff/session', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'invalid.token' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('ยืนยันตัวตนผ่าน LINE ไม่สำเร็จ');
  });

  it('ยืนยันสำเร็จ → resolve citizen, audit, คืน displayName + pictureUrl และตั้ง cookie', async () => {
    mockVerifyLineIdToken.mockResolvedValueOnce({
      lineUserId: 'U1234567890abcdef1234567890abcdef',
      displayName: 'สมชาย นามสกุล',
      pictureUrl: 'https://profile.line-scdn.net/avatar.jpg',
    });
    mockResolveCitizen.mockResolvedValueOnce('user-uuid-123');

    const req = new NextRequest('http://localhost/api/liff/session', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'valid.mock.token' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      displayName: 'สมชาย นามสกุล',
      pictureUrl: 'https://profile.line-scdn.net/avatar.jpg',
    });

    expect(mockResolveCitizen).toHaveBeenCalledWith({
      kind: 'line',
      lineUserId: 'U1234567890abcdef1234567890abcdef',
      fullName: 'สมชาย นามสกุล',
      profile: {
        displayName: 'สมชาย นามสกุล',
        pictureUrl: 'https://profile.line-scdn.net/avatar.jpg',
      },
      source: 'liff_session',
    });

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-uuid-123',
        action: 'liff_login',
        resource: 'auth',
      }),
    );

    const setCookie = res.cookies.get(LIFF_SESSION_COOKIE);
    expect(setCookie).toBeDefined();
    expect(setCookie?.value).toContain('U1234567890abcdef1234567890abcdef');
    expect(setCookie?.httpOnly).toBe(true);
  });
});

describe('GET /api/liff/session', () => {
  it('ไม่มี cookie → authenticated: false', async () => {
    const req = new NextRequest('http://localhost/api/liff/session');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false });
  });

  it('cookie เสีย / ปลอมแปลง → authenticated: false', async () => {
    const req = new NextRequest('http://localhost/api/liff/session', {
      headers: {
        cookie: `${LIFF_SESSION_COOKIE}=fake-tampered-cookie`,
      },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false });
  });

  it('cookie ถูกต้อง → คืน authenticated: true พร้อม displayName และ pictureUrl', async () => {
    const sessionVal = createLiffSessionValue('U1234567890abcdef1234567890abcdef');
    mockFindLineUserByRaw.mockResolvedValueOnce({
      displayName: 'สมหญิง ใจดี',
      pictureUrl: 'https://profile.line-scdn.net/somying.jpg',
    });

    const req = new NextRequest('http://localhost/api/liff/session', {
      headers: {
        cookie: `${LIFF_SESSION_COOKIE}=${sessionVal}`,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authenticated: true,
      displayName: 'สมหญิง ใจดี',
      pictureUrl: 'https://profile.line-scdn.net/somying.jpg',
    });
  });

  it('cookie ถูกต้องแต่ DB query error → fallback คืน authenticated: true', async () => {
    const sessionVal = createLiffSessionValue('U1234567890abcdef1234567890abcdef');
    mockFindLineUserByRaw.mockRejectedValueOnce(new Error('DB disconnect'));

    const req = new NextRequest('http://localhost/api/liff/session', {
      headers: {
        cookie: `${LIFF_SESSION_COOKIE}=${sessionVal}`,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: true });
  });
});

describe('DELETE /api/liff/session', () => {
  it('ล้าง session cookie สำเร็จ', async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const cookie = res.cookies.get(LIFF_SESSION_COOKIE);
    expect(cookie?.value).toBe('');
    expect(cookie?.maxAge).toBe(0);
  });
});
