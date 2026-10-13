import { describe, expect, test, vi } from 'vitest';

const dbStub = vi.hoisted(() => ({
  mode: 'ok' as 'unique' | 'broken',
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => [{ id: 'c1', status: 'closed' }],
        }),
      }),
    }),
    insert: () => ({
      values: async () => {
        if (dbStub.mode === 'unique') throw { code: '23505' };
        if (dbStub.mode === 'broken') throw new Error('conn reset');
        return [];
      },
    }),
  })),
}));

import { submitFeedback } from './feedback';

describe('submitFeedback error mapping', () => {
  test('unique violation → duplicate', async () => {
    dbStub.mode = 'unique';
    const res = await submitFeedback({ trackingCode: 'HG123456789', rating: 5 });
    expect(res).toMatchObject({ ok: false, code: 'duplicate' });
  });

  test('DB ล้มแบบอื่น → server_error (ไม่ใช่ duplicate)', async () => {
    dbStub.mode = 'broken';
    const res = await submitFeedback({ trackingCode: 'HG123456789', rating: 5 });
    expect(res).toMatchObject({ ok: false, code: 'server_error' });
  });
});
