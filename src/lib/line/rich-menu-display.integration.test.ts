import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { richMenus } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

const line = vi.hoisted(() => ({
  defaultId: null as string | null,
  setCalls: [] as string[],
  cancelCalls: 0,
}));

vi.mock('@/lib/line/client', () => ({
  createLineRichMenu: vi.fn(async () => 'line-x'),
  getLineRichMenu: vi.fn(async () => null),
  deleteLineRichMenu: vi.fn(async () => {}),
  getDefaultLineRichMenu: vi.fn(async () => line.defaultId),
  setDefaultLineRichMenu: vi.fn(async (id: string) => {
    line.setCalls.push(id);
    line.defaultId = id;
  }),
  cancelDefaultLineRichMenu: vi.fn(async () => {
    line.cancelCalls += 1;
    line.defaultId = null;
  }),
  uploadLineRichMenuImage: vi.fn(async () => {}),
}));

import { runDisplayTick } from './rich-menu-service';

const T0 = new Date('2026-10-13T12:00:00Z');
const PAST = new Date('2026-10-13T11:00:00Z');

const createdIds: string[] = [];

async function seedMenu(over: Record<string, unknown> = {}) {
  const db = await getDb();
  const id = generateId();
  await db.insert(richMenus).values({
    id,
    name: `it-display-${id}`,
    chatBarText: 'เมนูหลัก',
    config: { size: { width: 2500, height: 1686 } } as never,
    status: 'draft',
    ...over,
  } as never);
  createdIds.push(id);
  return id;
}

async function readStatus(id: string) {
  const db = await getDb();
  const [row] = await db.select({ status: richMenus.status }).from(richMenus).where(eq(richMenus.id, id)).limit(1);
  return row!.status;
}

beforeEach(async () => {
  line.defaultId = null;
  line.setCalls = [];
  line.cancelCalls = 0;
  // § ล้างซากจากรันที่โดน kill กลางคัน — กัน unique ชน line_rich_menu_id
  const db = await getDb();
await db.execute(sql`DELETE FROM rich_menus WHERE name LIKE 'it-display-%'`);
});

afterAll(async () => {
  const db = await getDb();
  for (const id of createdIds) {
    await db.delete(richMenus).where(eq(richMenus.id, id));
  }
  await closeDb();
});

describe('runDisplayTick', () => {
  test('ถึงเวลาเริ่ม → active + ตั้ง default', async () => {
    const id = await seedMenu({ lineRichMenuId: 'line-1', syncStatus: 'synced', displayStartAt: PAST });
    const res = await runDisplayTick(T0);
    expect(res.activated).toBe(1);
    expect(await readStatus(id)).toBe('active');
    expect(line.setCalls).toEqual(['line-1']);
  });

  test('หมดเวลา + เป็น default อยู่ → inactive + ยกเลิก default', async () => {
    line.defaultId = 'line-9';
    const id = await seedMenu({
      lineRichMenuId: 'line-9',
      syncStatus: 'synced',
      status: 'active',
      displayStartAt: PAST,
      displayEndAt: PAST,
    });
    const res = await runDisplayTick(T0);
    expect(res.expired).toBe(1);
    expect(await readStatus(id)).toBe('inactive');
    expect(line.cancelCalls).toBe(1);
  });

  test('หมดเวลาแต่ default เป็นของคนอื่น → inactive แต่ไม่ยกเลิก', async () => {
    line.defaultId = 'line-other';
    const id = await seedMenu({
      lineRichMenuId: 'line-9',
      syncStatus: 'synced',
      status: 'active',
      displayStartAt: PAST,
      displayEndAt: PAST,
    });
    const res = await runDisplayTick(T0);
    expect(res.expired).toBe(1);
    expect(await readStatus(id)).toBe('inactive');
    expect(line.cancelCalls).toBe(0);
  });
});
