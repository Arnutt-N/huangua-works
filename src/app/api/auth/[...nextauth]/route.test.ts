import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(async () => new Response('ok')),
}));

vi.mock('@/auth', () => ({ handlers: { GET: mockGet, POST: mockPost } }));

const route = await import('./route');

function post(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/[...nextauth] · บล็อก credentials callback', () => {
  // § login staff เข้าได้ทาง server action เท่านั้น — HTTP callback ข้าม rate limit + audit
  it.each([
    '/api/auth/callback/credentials',
    '/api/auth/callback/credentials/',
    '/api/auth//callback//credentials',
  ])('%s → 404 ไม่ถึง Auth.js', async (path) => {
    const res = await route.POST(post(path));

    expect(res.status).toBe(404);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it.each(['/api/auth/signout', '/api/auth/callback/other'])('%s → ส่งต่อ Auth.js', async (path) => {
    const res = await route.POST(post(path));

    expect(res.status).toBe(200);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('GET ไม่ถูกแตะ — export handler ของ Auth.js ตรง ๆ', () => {
    expect(route.GET).toBe(mockGet);
  });
});
