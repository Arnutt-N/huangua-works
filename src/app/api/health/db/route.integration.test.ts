import { describe, expect, test } from 'vitest';
import { GET } from './route';

describe('GET /api/health/db', () => {
  test('returns counts with zero PII keys', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      latencyMs: number;
      tables: { cases: number; users: number };
    };
    expect(body.ok).toBe(true);
    expect(typeof body.latencyMs).toBe('number');
    expect(typeof body.tables.cases).toBe('number');
    expect(typeof body.tables.users).toBe('number');
    const raw = JSON.stringify(body);
    for (const banned of ['email', 'fullName', 'trackingCode', 'password']) {
      expect(raw).not.toContain(banned);
    }
  });
});
