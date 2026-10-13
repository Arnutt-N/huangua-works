import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { richMenus } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

const line = vi.hoisted(() => ({
  remoteMenu: null as Record<string, unknown> | null,
  created: [] as unknown[],
  deleted: [] as string[],
  defaultSet: [] as string[],
}));

vi.mock('@/lib/line/client', () => ({
  createLineRichMenu: vi.fn(async (config: unknown) => {
    line.created.push(config);
    return `line-new-${line.created.length}`;
  }),
  getLineRichMenu: vi.fn(async () => line.remoteMenu),
  deleteLineRichMenu: vi.fn(async (id: string) => {
    line.deleted.push(id);
  }),
  setDefaultLineRichMenu: vi.fn(async (id: string) => {
    line.defaultSet.push(id);
  }),
  uploadLineRichMenuImage: vi.fn(async () => {}),
}));

import { syncRichMenu } from './rich-menu-service';

const CONFIG = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'เมนูบริการงานช่าง อบต.หัวงัว',
  chatBarText: 'เมนูหลัก',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: 'message', text: 'ติดต่อเจ้าหน้าที่' },
    },
  ],
};

let menuId: string;

async function seedMenu(overrides: Partial<{ lineRichMenuId: string | null; status: 'draft' | 'active'; config: unknown }> = {}) {
  const db = await getDb();
  menuId = generateId();
  await db.insert(richMenus).values({
    id: menuId,
    name: `it-sync-${menuId}`,
    chatBarText: 'เมนูหลัก',
    config: (overrides.config ?? CONFIG) as never,
    lineRichMenuId: overrides.lineRichMenuId ?? null,
    status: overrides.status ?? 'draft',
    createdBy: 'it-sync',
  });
}

async function readMenu() {
  const db = await getDb();
  const [row] = await db.select().from(richMenus).where(eq(richMenus.id, menuId)).limit(1);
  return row!;
}

beforeEach(async () => {
  line.remoteMenu = null;
  line.created = [];
  line.deleted = [];
  line.defaultSet = [];
  const db = await getDb();
  if (menuId) await db.delete(richMenus).where(eq(richMenus.id, menuId));
});

afterAll(async () => {
  const db = await getDb();
  if (menuId) await db.delete(richMenus).where(eq(richMenus.id, menuId));
  await closeDb();
});

describe('syncRichMenu recreate', () => {
  test('config ตรงกัน → no-op ไม่สร้างซ้ำ', async () => {
    await seedMenu({ lineRichMenuId: 'line-old' });
    line.remoteMenu = { ...CONFIG };
    const res = await syncRichMenu(menuId);
    expect(res.ok).toBe(true);
    expect(res.recreated).toBeFalsy();
    expect(line.created).toHaveLength(0);
    expect((await readMenu()).lineRichMenuId).toBe('line-old');
  });

  test('areas เปลี่ยน + active → recreate ย้าย default ก่อนลบ', async () => {
    await seedMenu({ lineRichMenuId: 'line-old', status: 'active' });
    line.remoteMenu = { ...CONFIG, areas: [] };
    const res = await syncRichMenu(menuId);
    expect(res.ok).toBe(true);
    expect(res.recreated).toBe(true);
    const row = await readMenu();
    expect(row.lineRichMenuId).toBe('line-new-1');
    expect(line.defaultSet).toEqual(['line-new-1']);
    expect(line.deleted).toEqual(['line-old']);
  });

  test('id stale (LINE ไม่มี) → สร้างใหม่ ไม่ลบ', async () => {
    await seedMenu({ lineRichMenuId: 'line-gone', status: 'draft' });
    line.remoteMenu = null;
    const res = await syncRichMenu(menuId);
    expect(res.ok).toBe(true);
    expect(res.recreated).toBe(true);
    expect((await readMenu()).lineRichMenuId).toBe('line-new-1');
    expect(line.deleted).toHaveLength(0);
    expect(line.defaultSet).toHaveLength(0);
  });

  test('ยังไม่ sync → สร้างครั้งแรก', async () => {
    await seedMenu({});
    const res = await syncRichMenu(menuId);
    expect(res.ok).toBe(true);
    expect(line.created).toHaveLength(1);
    expect((await readMenu()).lineRichMenuId).toBe('line-new-1');
  });
});
