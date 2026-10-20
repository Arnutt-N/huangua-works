import { eq, ilike, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { lineFriendEvents, lineUsers, richMenus } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { pseudonymizeLineId } from '@/lib/line/identity';

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: 'admin-1' }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));

vi.mock('@/lib/audit', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { ...mod, logAudit: vi.fn(async () => {}) };
});

import { DELETE, POST } from './route';

const RAW_USER = 'U_it_friends_assign_raw';
let userPk = '';
let syncedMenuId = '';
let draftMenuId = '';
let inactiveMenuId = '';

const lineCalls: { method: string; url: string }[] = [];

/**
 * § stub แยก LINE API ออกจาก infra — withLineCircuit ยิง redis.get ผ่าน global fetch
 * เหมือนกัน จึงนับเฉพาะ api.line.me เป็น LINE call (กัน circuit call ปนมาใน assertion)
 */
function stubLineWith(status: number, body: string | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: { method?: string }) => {
      const href = typeof url === 'string' ? url : url.toString();
      if (!href.includes('api.line.me')) {
        return new Response('null', { status: 200 });
      }
      lineCalls.push({ method: init?.method ?? 'GET', url: href });
      return new Response(body, { status });
    }),
  );
}

function stubLineOk() {
  stubLineWith(200, null);
}

function req(id: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost:3000/api/line/admin/friends/${id}/rich-menu`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(async () => {
  vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', 'it-test-token');
  stubLineOk();
  lineCalls.length = 0;

  const db = await getDb();
  // § กันแถวค้างจากรันที่ crash (prefix ของไฟล์นี้เท่านั้น)
  const orphanUsers = await db
    .select({ id: lineUsers.id })
    .from(lineUsers)
    .where(ilike(lineUsers.displayName, 'it-fr-assign%'));
  if (orphanUsers.length > 0) {
    const orphanIds = orphanUsers.map((o) => o.id);
    await db.delete(lineFriendEvents).where(inArray(lineFriendEvents.lineUserId, orphanIds));
    await db.delete(lineUsers).where(inArray(lineUsers.id, orphanIds));
  }
  await db.execute(sql`DELETE FROM rich_menus WHERE name LIKE 'it-fr-menu-%'`);
  userPk = generateId();
  const p = pseudonymizeLineId(RAW_USER);
  await db.insert(lineUsers).values({
    id: userPk,
    lineUserIdHash: p.hash,
    lineUserIdEnc: p.enc,
    lineUserIdHashV: p.v,
    displayName: 'it-fr-assign',
  });

  syncedMenuId = generateId();
  await db.insert(richMenus).values({
    id: syncedMenuId,
    name: 'it-fr-menu-synced',
    chatBarText: 'เมนู',
    config: { size: { width: 2500, height: 1686 } } as never,
    lineRichMenuId: 'line-it-fr-synced',
    status: 'active',
    syncStatus: 'synced',
  });

  draftMenuId = generateId();
  await db.insert(richMenus).values({
    id: draftMenuId,
    name: 'it-fr-menu-draft',
    chatBarText: 'เมนู',
    config: { size: { width: 2500, height: 1686 } } as never,
  });

  inactiveMenuId = generateId();
  await db.insert(richMenus).values({
    id: inactiveMenuId,
    name: 'it-fr-menu-inactive',
    chatBarText: 'เมนู',
    config: { size: { width: 2500, height: 1686 } } as never,
    lineRichMenuId: 'line-it-fr-inactive',
    status: 'inactive',
    syncStatus: 'synced',
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  const db = await getDb();
  await db.delete(lineFriendEvents).where(eq(lineFriendEvents.lineUserId, userPk));
  await db.delete(lineUsers).where(eq(lineUsers.id, userPk));
  await db
    .delete(richMenus)
    .where(inArray(richMenus.id, [syncedMenuId, draftMenuId, inactiveMenuId].filter(Boolean)));
  userPk = syncedMenuId = draftMenuId = inactiveMenuId = '';
});

afterAll(async () => {
  await closeDb();
});

describe('POST /api/line/admin/friends/[id]/rich-menu', () => {
  test('ผูกเมนูที่ sync แล้ว → 200 + จำใน metadata + ยิง LINE link + ไม่มี raw id', async () => {
    const res = await POST(req(userPk, 'POST', { richMenuId: syncedMenuId }), params(userPk));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.richMenuId).toBe(syncedMenuId);
    expect(body.richMenuName).toBe('it-fr-menu-synced');

    // § mask audit ฝั่ง assign (T5)
    expect(JSON.stringify(body)).not.toContain(RAW_USER);

    expect(lineCalls).toHaveLength(1);
    expect(lineCalls[0]!.method).toBe('POST');
    expect(lineCalls[0]!.url).toContain('/richmenu/line-it-fr-synced');

    const db = await getDb();
    const [row] = await db.select().from(lineUsers).where(eq(lineUsers.id, userPk)).limit(1);
    expect((row!.metadata as { richMenuId?: string }).richMenuId).toBe(syncedMenuId);
  });

  test('เมนูยังไม่ sync → 422 และไม่ยิง LINE', async () => {
    const res = await POST(req(userPk, 'POST', { richMenuId: draftMenuId }), params(userPk));
    expect(res.status).toBe(422);
    expect(lineCalls).toHaveLength(0);
  });

  test('เมนูถูกปิดใช้งาน → 422 และไม่ยิง LINE', async () => {
    const res = await POST(req(userPk, 'POST', { richMenuId: inactiveMenuId }), params(userPk));
    expect(res.status).toBe(422);
    expect(lineCalls).toHaveLength(0);
  });

  test('LINE ล้ม → ข้อความไทย ไม่ leak raw detail', async () => {
    stubLineWith(500, '{"message":"error"}');
    const res = await POST(req(userPk, 'POST', { richMenuId: syncedMenuId }), params(userPk));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).not.toContain('message');
    expect(JSON.stringify(body)).not.toContain(RAW_USER);
  });

  test('body ไม่มี richMenuId → 400', async () => {
    const res = await POST(req(userPk, 'POST', {}), params(userPk));
    expect(res.status).toBe(400);
    expect(lineCalls).toHaveLength(0);
  });

  test('เมนูไม่มีอยู่ → 404', async () => {
    const res = await POST(req(userPk, 'POST', { richMenuId: generateId() }), params(userPk));
    expect(res.status).toBe(404);
    expect(lineCalls).toHaveLength(0);
  });

  test('เพื่อนไม่มีอยู่ → 404', async () => {
    const missing = generateId();
    const res = await POST(req(missing, 'POST', { richMenuId: syncedMenuId }), params(missing));
    expect(res.status).toBe(404);
    expect(lineCalls).toHaveLength(0);
  });

  test('ไม่มี LINE token → 503 และไม่แตะ metadata', async () => {
    vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', '');
    const res = await POST(req(userPk, 'POST', { richMenuId: syncedMenuId }), params(userPk));
    expect(res.status).toBe(503);
    const db = await getDb();
    const [row] = await db.select().from(lineUsers).where(eq(lineUsers.id, userPk)).limit(1);
    expect((row!.metadata as { richMenuId?: string } | null)?.richMenuId).toBeUndefined();
  });
});

describe('DELETE /api/line/admin/friends/[id]/rich-menu', () => {
  test('ปลดเมนู → 200 + ล้าง metadata + ยิง LINE unlink', async () => {
    const db = await getDb();
    await db
      .update(lineUsers)
      .set({ metadata: { richMenuId: syncedMenuId } })
      .where(eq(lineUsers.id, userPk));

    const res = await DELETE(req(userPk, 'DELETE'), params(userPk));
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain(RAW_USER);

    expect(lineCalls).toHaveLength(1);
    expect(lineCalls[0]!.method).toBe('DELETE');
    expect(lineCalls[0]!.url).toContain('/richmenu');

    const [row] = await db.select().from(lineUsers).where(eq(lineUsers.id, userPk)).limit(1);
    expect((row!.metadata as { richMenuId?: string }).richMenuId).toBeUndefined();
  });

  test('ไม่มี assignment → 404 และไม่ยิง LINE', async () => {
    const res = await DELETE(req(userPk, 'DELETE'), params(userPk));
    expect(res.status).toBe(404);
    expect(lineCalls).toHaveLength(0);
  });

  test('LINE ตอบ 404 (link หายฝั่ง LINE) → 200 + ล้าง metadata ต่อ ไม่ค้าง', async () => {
    const db = await getDb();
    await db
      .update(lineUsers)
      .set({ metadata: { richMenuId: syncedMenuId } })
      .where(eq(lineUsers.id, userPk));
    stubLineWith(404, '{"message":"Not found"}');

    const res = await DELETE(req(userPk, 'DELETE'), params(userPk));
    expect(res.status).toBe(200);

    const [row] = await db.select().from(lineUsers).where(eq(lineUsers.id, userPk)).limit(1);
    expect((row!.metadata as { richMenuId?: string }).richMenuId).toBeUndefined();
  });
});
