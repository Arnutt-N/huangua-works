import { describe, expect, test, vi } from 'vitest';

const stubs = vi.hoisted(() => ({
  rows: [] as Array<{ id: string }>,
  insertThrow: null as unknown,
  remoteTarget: null as string | null,
  deleted: [] as string[],
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({
    select: (cols: object) => ({
      from: () => ({
        where: () => ({
          // แยก alias-check ({id}) กับ target lookup ({lineRichMenuId}) ด้วยชื่อคอลัมน์
          limit: () => ('lineRichMenuId' in cols ? [{ lineRichMenuId: 'line-mine', syncStatus: 'synced' }] : stubs.rows),
        }),
      }),
    }),
    insert: () => ({
      values: async () => {
        if (stubs.insertThrow) throw stubs.insertThrow;
        return [];
      },
    }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
  })),
}));

vi.mock('@/lib/line/client', () => ({
  createLineRichMenu: vi.fn(async () => 'line-x'),
  getLineRichMenu: vi.fn(async () => null),
  deleteLineRichMenu: vi.fn(async () => {}),
  getDefaultLineRichMenu: vi.fn(async () => null),
  setDefaultLineRichMenu: vi.fn(async () => {}),
  cancelDefaultLineRichMenu: vi.fn(async () => {}),
  uploadLineRichMenuImage: vi.fn(async () => {}),
  getAliasOnLine: vi.fn(async () => (stubs.remoteTarget ? { richMenuId: stubs.remoteTarget } : null)),
  createAliasOnLine: vi.fn(async () => {}),
  updateAliasOnLine: vi.fn(async () => {}),
  deleteAliasOnLine: vi.fn(async (id: string) => {
    stubs.deleted.push(id);
  }),
}));

import { createMenuAlias } from './rich-menu-service';

describe('createMenuAlias compensation (unit, stubbed db)', () => {
  test('insert ล้ม + remote เป็นของเรา → ลบชดเชย', async () => {
    stubs.rows = [];
    stubs.insertThrow = new Error('db down');
    stubs.remoteTarget = 'line-mine';
    stubs.deleted = [];
    const res = await createMenuAlias('it-x', 'menu-x');
    expect(res.ok).toBe(false);
    expect(stubs.deleted).toEqual(['it-x']);
  });

  test('insert ล้ม + remote เป็นของคนอื่น → ไม่ลบ', async () => {
    stubs.rows = [];
    stubs.insertThrow = new Error('db down');
    stubs.remoteTarget = 'line-other';
    stubs.deleted = [];
    const res = await createMenuAlias('it-x', 'menu-x');
    expect(res.ok).toBe(false);
    expect(stubs.deleted).toEqual([]);
  });
});
