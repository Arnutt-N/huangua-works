import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { richMenuAliases, richMenus } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

const mocks = vi.hoisted(() => ({ currentUserId: 'admin-1' }));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: mocks.currentUserId }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));

vi.mock('@/lib/audit', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { ...mod, logAudit: vi.fn(async () => {}) };
});

const lineMock = vi.hoisted(() => ({ defaultId: null as string | null, deleted: [] as string[] }));

vi.mock('@/lib/line/client', () => ({
  getDefaultLineRichMenu: vi.fn(async () => lineMock.defaultId),
  deleteLineRichMenu: vi.fn(async (id: string) => {
    lineMock.deleted.push(id);
  }),
}));

import { DELETE, PATCH } from './route';

const menuIds: string[] = [];

async function seedMenu() {
  const db = await getDb();
  const id = generateId();
  await db.insert(richMenus).values({
    id,
    name: `it-menu-${id}`,
    chatBarText: 'เมนูหลัก',
    config: { size: { width: 2500, height: 1686 } } as never,
  });
  menuIds.push(id);
  return id;
}

function req(method: string, body?: unknown): Request {
  return new Request('http://localhost:3000/api/line/admin/rich-menus/m1', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(async () => {
  lineMock.defaultId = null;
  lineMock.deleted = [];
  const db = await getDb();
  await db.execute(sql`DELETE FROM rich_menu_aliases WHERE alias_id LIKE 'it-%'`);
  await db.execute(sql`DELETE FROM rich_menus WHERE name LIKE 'it-menu-%'`);
});

afterAll(async () => {
  const db = await getDb();
  await db.execute(sql`DELETE FROM rich_menu_aliases WHERE alias_id LIKE 'it-%'`);
  for (const id of menuIds) {
    await db.delete(richMenus).where(eq(richMenus.id, id));
  }
  await closeDb();
});

describe('PATCH/DELETE rich-menus/[id]', () => {
  test('PATCH ตั้ง window ได้', async () => {
    const id = await seedMenu();
    const res = await PATCH(
      req('PATCH', { displayStartAt: '2026-11-01T00:00:00Z', displayEndAt: '2026-11-30T00:00:00Z' }),
      params(id),
    );
    expect(res.status).toBe(200);
    const db = await getDb();
    const [row] = await db.select().from(richMenus).where(eq(richMenus.id, id)).limit(1);
    expect(row!.displayStartAt).not.toBeNull();
  });

  test('PATCH end ก่อน start → 400', async () => {
    const id = await seedMenu();
    const res = await PATCH(
      req('PATCH', { displayStartAt: '2026-11-30T00:00:00Z', displayEndAt: '2026-11-01T00:00:00Z' }),
      params(id),
    );
    expect(res.status).toBe(400);
  });

  test('PATCH ล้าง window (null คู่) → manual', async () => {
    const id = await seedMenu();
    const res = await PATCH(req('PATCH', { displayStartAt: null, displayEndAt: null }), params(id));
    expect(res.status).toBe(200);
  });

  test('DELETE ติด alias → 409', async () => {
    const db = await getDb();
    const id = await seedMenu();
    await db.insert(richMenuAliases).values({ id: generateId(), aliasId: 'it-block', richMenuId: id });
    const res = await DELETE(req('DELETE'), params(id));
    expect(res.status).toBe(409);
  });

  test('PATCH ข้างเดียวกลับหัวกับของเก่า → 400', async () => {
    const id = await seedMenu();
    const db = await getDb();
    await db
      .update(richMenus)
      .set({ displayStartAt: new Date('2026-11-15T00:00:00Z') })
      .where(eq(richMenus.id, id));
    const res = await PATCH(req('PATCH', { displayEndAt: '2026-11-01T00:00:00Z' }), params(id));
    expect(res.status).toBe(400);
  });

  test('PATCH ว่าง {} → 400', async () => {
    const id = await seedMenu();
    const res = await PATCH(req('PATCH', {}), params(id));
    expect(res.status).toBe(400);
  });

  test('DELETE เมนูที่เป็น default สด → 409', async () => {
    const db = await getDb();
    const id = await seedMenu();
    await db.update(richMenus).set({ lineRichMenuId: 'line-live', status: 'active' }).where(eq(richMenus.id, id));
    lineMock.defaultId = 'line-live';
    const res = await DELETE(req('DELETE'), params(id));
    expect(res.status).toBe(409);
    const rows = await db.select().from(richMenus).where(eq(richMenus.id, id));
    expect(rows).toHaveLength(1);
  });

  test('DELETE ไม่มี alias → 200 แถวหาย', async () => {
    const id = await seedMenu();
    const res = await DELETE(req('DELETE'), params(id));
    expect(res.status).toBe(200);
    const db = await getDb();
    const rows = await db.select().from(richMenus).where(eq(richMenus.id, id));
    expect(rows).toHaveLength(0);
  });
});
