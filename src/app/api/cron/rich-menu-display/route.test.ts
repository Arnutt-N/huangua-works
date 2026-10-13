import { describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/line/rich-menu-service', () => ({
  runDisplayTick: vi.fn(async () => ({ activated: 1, expired: 0 })),
}));

import { GET } from './route';

function cronRequest(secret?: string): Request {
  return new Request('http://localhost:3000/api/cron/rich-menu-display', {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe('GET cron/rich-menu-display', () => {
  test('ไม่มี secret → 401', async () => {
    const res = await GET(cronRequest());
    expect(res.status).toBe(401);
  });

  test('secret ผิด → 401', async () => {
    const res = await GET(cronRequest('wrong-secret-value'));
    expect(res.status).toBe(401);
  });

  test('secret ถูก → 200 พร้อมยอด', async () => {
    const res = await GET(cronRequest(process.env.CRON_SECRET));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; activated: number; expired: number };
    expect(body).toEqual({ ok: true, activated: 1, expired: 0 });
  });
});
