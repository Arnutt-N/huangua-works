import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { richMenuAliases, richMenus } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

const line = vi.hoisted(() => ({
  created: [] as Array<{ aliasId: string; menuId: string }>,
  updated: [] as Array<{ aliasId: string; menuId: string }>,
  deleted: [] as string[],
  remote: new Map<string, string>(),
  failInsert: false,
}));

vi.mock('@/lib/line/client', () => ({
  createLineRichMenu: vi.fn(async () => 'line-x'),
  getLineRichMenu: vi.fn(async () => null),
  deleteLineRichMenu: vi.fn(async () => {}),
  getDefaultLineRichMenu: vi.fn(async () => null),
  setDefaultLineRichMenu: vi.fn(async () => {}),
  cancelDefaultLineRichMenu: vi.fn(async () => {}),
  uploadLineRichMenuImage: vi.fn(async () => {}),
  getAliasOnLine: vi.fn(async (aliasId: string) => {
    const menuId = line.remote.get(aliasId);
    return menuId ? { richMenuId: menuId } : null;
  }),
  createAliasOnLine: vi.fn(async (aliasId: string, menuId: string) => {
    if (line.remote.has(aliasId)) {
      const err = new Error('LINE API /richmenu/alias failed (400): alias exists');
      (err as { status?: number }).status = 400;
      throw err;
    }
    line.remote.set(aliasId, menuId);
    line.created.push({ aliasId, menuId });
  }),
  updateAliasOnLine: vi.fn(async (aliasId: string, menuId: string) => {
    line.updated.push({ aliasId, menuId });
  }),
  deleteAliasOnLine: vi.fn(async (aliasId: string) => {
    line.remote.delete(aliasId);
    line.deleted.push(aliasId);
  }),
}));

import { createMenuAlias, deleteMenuAlias, repointMenuAlias } from './rich-menu-service';

const menuIds: string[] = [];

async function seedMenu(lineId: string) {
  const db = await getDb();
  const id = generateId();
  await db.insert(richMenus).values({
    id,
    name: `it-alias-${id}`,
    chatBarText: 'เมนูหลัก',
    config: { size: { width: 2500, height: 1686 } } as never,
    lineRichMenuId: lineId,
    syncStatus: 'synced',
  });
  menuIds.push(id);
  return id;
}

beforeEach(async () => {
  line.created = [];
  line.updated = [];
  line.deleted = [];
  line.remote.clear();
  const db = await getDb();
  await db.execute(sql`DELETE FROM rich_menu_aliases WHERE alias_id LIKE 'it-%'`);
  await db.execute(sql`DELETE FROM rich_menus WHERE name LIKE 'it-alias-%'`);
});

afterAll(async () => {
  const db = await getDb();
  await db.execute(sql`DELETE FROM rich_menu_aliases WHERE alias_id LIKE 'it-%'`);
  for (const id of menuIds) {
    await db.delete(richMenus).where(eq(richMenus.id, id));
  }
  await closeDb();
});

describe('menu aliases', () => {
  test('สร้าง alias → LINE + แถว local', async () => {
    const menuId = await seedMenu('line-a1');
    const res = await createMenuAlias('it-main', menuId);
    expect(res.ok).toBe(true);
    expect(line.created).toEqual([{ aliasId: 'it-main', menuId: 'line-a1' }]);
    const db = await getDb();
    const rows = await db.select().from(richMenuAliases).where(eq(richMenuAliases.aliasId, 'it-main'));
    expect(rows).toHaveLength(1);
  });

  test('เป้าไม่ sync → ปฏิเสธ ไม่ยิง LINE', async () => {
    const menuId = await seedMenu('line-a2');
    const db = await getDb();
    await db.update(richMenus).set({ syncStatus: 'error' }).where(eq(richMenus.id, menuId));
    const res = await createMenuAlias('it-bad', menuId);
    expect(res.ok).toBe(false);
    expect(line.created).toHaveLength(0);
  });

  test('ย้ายเป้า → PUT บน LINE + อัปเดตแถว', async () => {
    const m1 = await seedMenu('line-b1');
    const m2 = await seedMenu('line-b2');
    expect((await createMenuAlias('it-move', m1)).ok).toBe(true);
    const res = await repointMenuAlias('it-move', m2);
    expect(res.ok).toBe(true);
    expect(line.updated).toEqual([{ aliasId: 'it-move', menuId: 'line-b2' }]);
  });

  test('ชื่อซ้ำในระบบ → ปฏิเสธก่อนยิง LINE (local-first)', async () => {
    const menuId = await seedMenu('line-d1');
    expect((await createMenuAlias('it-dup', menuId)).ok).toBe(true);
    const res = await createMenuAlias('it-dup', menuId);
    expect(res.ok).toBe(false);
    expect(line.created).toHaveLength(1);
  });

  test('ย้ายเป้า → updatedAt ขยับ', async () => {
    const m1 = await seedMenu('line-e1');
    const m2 = await seedMenu('line-e2');
    expect((await createMenuAlias('it-ts', m1)).ok).toBe(true);
    const db = await getDb();
    const [before] = await db.select().from(richMenuAliases).where(eq(richMenuAliases.aliasId, 'it-ts'));
    await new Promise((r) => setTimeout(r, 15));
    expect((await repointMenuAlias('it-ts', m2)).ok).toBe(true);
    const [after] = await db.select().from(richMenuAliases).where(eq(richMenuAliases.aliasId, 'it-ts'));
    expect(after!.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());
  });

  test('ชน 4xx เป้าตรง (crash ค้าง) → reconcile เขียนแถวคืน + ok', async () => {
    const menuId = await seedMenu('line-r1');
    line.remote.set('it-rec', 'line-r1');
    const res = await createMenuAlias('it-rec', menuId);
    expect(res.ok).toBe(true);
    const db = await getDb();
    const rows = await db.select().from(richMenuAliases).where(eq(richMenuAliases.aliasId, 'it-rec'));
    expect(rows).toHaveLength(1);
  });

  test('ชน 4xx เป้าเป็นของคนอื่น → ไม่ลบของเขา + error', async () => {
    const menuId = await seedMenu('line-r2');
    line.remote.set('it-race', 'line-other');
    const res = await createMenuAlias('it-race', menuId);
    expect(res.ok).toBe(false);
    expect(line.deleted).not.toContain('it-race');
    expect(line.remote.get('it-race')).toBe('line-other');
  });

  test('ลบของไม่มี → ok:false (ไม่มี audit ผี)', async () => {
    const res = await deleteMenuAlias('it-ghost');
    expect(res.ok).toBe(false);
  });

  test('ลบ → ลบ LINE ก่อนแล้วค่อยลบแถว', async () => {
    const menuId = await seedMenu('line-c1');
    expect((await createMenuAlias('it-del', menuId)).ok).toBe(true);
    const res = await deleteMenuAlias('it-del');
    expect(res.ok).toBe(true);
    expect(line.deleted).toEqual(['it-del']);
    const db = await getDb();
    const rows = await db.select().from(richMenuAliases).where(eq(richMenuAliases.aliasId, 'it-del'));
    expect(rows).toHaveLength(0);
  });
});
