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

const lineCalls: { method: string; url: string }[] = [];

function stubLineOk() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { method?: string }) => {
      lineCalls.push({ method: init?.method ?? 'GET', url });
      return new Response(null, { status: 200 });
    }),
  );
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
  // § กวาด orphan จากรันที่ crash ก่อน seed ใหม่ (displayName/menu prefix ของไฟล์นี้เท่านั้น)
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
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  const db = await getDb();
  await db.delete(lineFriendEvents).where(eq(lineFriendEvents.lineUserId, userPk));
  await db.delete(lineUsers).where(eq(lineUsers.id, userPk));
  await db
    .delete(richMenus)
    .where(inArray(richMenus.id, [syncedMenuId, draftMenuId].filter(Boolean)));
  userPk = syncedMenuId = draftMenuId = '';
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

    // § mask audit ฝั่ง assign ด้วย — raw id ห้ามหลุดทั้ง request/response
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
});
