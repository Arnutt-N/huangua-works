import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IneligibleAccountSignin } from '@/lib/auth/login-errors';

/**
 * สัญญา Auth.js ตัวติดตั้งจริง (PR #118 blast proof) — custom CredentialsSignin
 * ต้องถึง login action เป็น instance เดิมโดยไม่สร้าง JWT
 */

const requireFromNextAuth = createRequire(createRequire(import.meta.url).resolve('next-auth'));
const corePath = requireFromNextAuth.resolve('@auth/core');
const { Auth, raw, skipCSRFCheck } = await import(pathToFileURL(corePath).href);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function request(header = false) {
  return new Request('https://proof.invalid/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(header ? { 'x-auth-return-redirect': '1' } : {}),
    },
    body: new URLSearchParams({ email: 'proof@example.invalid', password: 'synthetic' }),
  });
}

describe('PR118 สัญญา Auth.js ที่ติดตั้งจริง', () => {
  it.each(['inactive', 'citizen_role'] as const)(
    'ส่งเหตุผล %s ด้วย instance เดิมโดยไม่สร้าง JWT',
    async (reason) => {
      const denial = new IneligibleAccountSignin(reason, 'synthetic-user');
      const jwt = vi.fn();
      const config = {
        basePath: '/api/auth',
        trustHost: true,
        secret: 'synthetic-proof-secret-only-never-a-real-deploy-secret',
        raw,
        skipCSRFCheck,
        session: { strategy: 'jwt' },
        providers: [
          {
            id: 'credentials',
            name: 'credentials',
            type: 'credentials',
            credentials: {},
            authorize: async () => {
              throw denial;
            },
          },
        ],
        callbacks: { jwt },
        logger: { error: () => {}, warn: () => {}, debug: () => {} },
      };
      await expect(Auth(request(), config)).rejects.toBe(denial);
      expect(jwt).not.toHaveBeenCalled();
      const response = await Auth(request(true), config);
      expect(response).toBeInstanceOf(Response);
      expect(await response.json()).toHaveProperty('url');
      expect(response.headers.get('set-cookie') ?? '').not.toMatch(/session-token=/);
      expect(jwt).not.toHaveBeenCalled();
    },
  );

  it('staff ที่ authorize ผ่านยังสร้าง JWT และ session cookie ได้', async () => {
    const jwt = vi.fn(async ({ token }: { token: unknown }) => token);
    const result = await Auth(request(), {
      basePath: '/api/auth',
      trustHost: true,
      secret: 'synthetic-proof-secret-only-never-a-real-deploy-secret',
      raw,
      skipCSRFCheck,
      session: { strategy: 'jwt' },
      providers: [
        {
          id: 'credentials',
          name: 'credentials',
          type: 'credentials',
          credentials: {},
          authorize: async () => ({ id: 'synthetic-staff', email: 'proof@example.invalid' }),
        },
      ],
      callbacks: { jwt },
      logger: { error: () => {}, warn: () => {}, debug: () => {} },
    });
    expect(jwt).toHaveBeenCalledTimes(1);
    expect(
      result.cookies.some((cookie: { name: string; value: string }) => cookie.name.endsWith('session-token') && cookie.value.length > 0),
    ).toBe(true);
  });
});
