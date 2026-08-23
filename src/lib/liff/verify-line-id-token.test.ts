import { describe, it, expect, afterEach, vi } from 'vitest';
import { verifyLineIdToken, isLiffMockEnabled } from './verify-line-id-token';

const CHANNEL_ID = '1234567890';
const NOW = Math.floor(Date.now() / 1000);

function linePayload(overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      iss: 'https://access.line.me',
      sub: 'Udeadbeefdeadbeefdeadbeefdeadbeef',
      aud: CHANNEL_ID,
      exp: NOW + 600,
      name: 'สมชาย ใจดี',
      picture: 'https://profile.line-scdn.net/p.png',
      ...overrides,
    }),
    { status: 200 },
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('verifyLineIdToken (ผ่าน LINE verify endpoint)', () => {
  it('token ถูกต้อง → ได้ identity ครบ (sub/name/picture)', async () => {
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', CHANNEL_ID);
    const identity = await verifyLineIdToken('valid.jwt.token', {
      fetchImpl: async () => linePayload(),
    });
    expect(identity.lineUserId).toBe('Udeadbeefdeadbeefdeadbeefdeadbeef');
    expect(identity.displayName).toBe('สมชาย ใจดี');
    expect(identity.pictureUrl).toBe('https://profile.line-scdn.net/p.png');
  });

  it('aud เป็น channel อื่น → ปฏิเสธ (กันเอา token ของ LIFF app อื่นมายิง)', async () => {
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', CHANNEL_ID);
    await expect(
      verifyLineIdToken('foreign.jwt.token', {
        fetchImpl: async () => linePayload({ aud: '9999999999' }),
      }),
    ).rejects.toThrow('aud');
  });

  it('exp ผ่านมาแล้ว → ปฏิเสธ แม้ LINE ตอบ 200', async () => {
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', CHANNEL_ID);
    await expect(
      verifyLineIdToken('expired.jwt.token', {
        fetchImpl: async () => linePayload({ exp: NOW - 1 }),
      }),
    ).rejects.toThrow('หมดอายุ');
  });

  it('iss ไม่ใช่ access.line.me → ปฏิเสธ', async () => {
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', CHANNEL_ID);
    await expect(
      verifyLineIdToken('evil.jwt.token', {
        fetchImpl: async () => linePayload({ iss: 'https://evil.example' }),
      }),
    ).rejects.toThrow('payload');
  });

  it('LINE ตอบ non-200 → ปฏิเสธ', async () => {
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', CHANNEL_ID);
    await expect(
      verifyLineIdToken('bad.jwt.token', {
        fetchImpl: async () => new Response('{"error":"invalid_request"}', { status: 400 }),
      }),
    ).rejects.toThrow('400');
  });

  it('ไม่ได้ตั้ง LINE_LOGIN_CHANNEL_ID → ปฏิเสธก่อนยิง network', async () => {
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', '');
    const fetchImpl = vi.fn();
    await expect(verifyLineIdToken('any.token', { fetchImpl })).rejects.toThrow(
      'LINE_LOGIN_CHANNEL_ID',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('mock mode (LIFF_E2E_MOCK)', () => {
  it('เปิด mock → ยอมรับ token รูปแบบ mock.<lineUserId> โดยไม่ยิง network', async () => {
    vi.stubEnv('LIFF_E2E_MOCK', '1');
    const fetchImpl = vi.fn();
    const identity = await verifyLineIdToken('mock.Utest123', { fetchImpl });
    expect(identity.lineUserId).toBe('Utest123');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(isLiffMockEnabled()).toBe(true);
  });

  it('เปิด mock แต่ token ไม่ใช่รูปแบบ mock → ปฏิเสธ', async () => {
    vi.stubEnv('LIFF_E2E_MOCK', '1');
    await expect(verifyLineIdToken('real.jwt.token')).rejects.toThrow('mock');
  });

  it('ปิด mock (ค่า env ว่าง) → isLiffMockEnabled เป็น false', () => {
    vi.stubEnv('LIFF_E2E_MOCK', '');
    expect(isLiffMockEnabled()).toBe(false);
  });
});
