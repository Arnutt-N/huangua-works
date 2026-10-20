import { ilike, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { lineFriendEvents, lineUsers } from '@/lib/db/schema';
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

import { GET } from './route';

const RAW_A = 'U_it_friends_raw_aaa';
const RAW_B = 'U_it_friends_raw_bbb';
const RAW_C = 'U_it_friends_raw_ccc';

let userA = '';
let userB = '';
let userC = '';

function req(query = ''): Request {
  return new Request(`http://localhost:3000/api/line/admin/friends${query}`);
}

async function seedUser(rawId: string, displayName: string, lastMessageAt: Date | null) {
  const db = await getDb();
  const id = generateId();
  const p = pseudonymizeLineId(rawId);
  await db.insert(lineUsers).values({
    id,
    lineUserIdHash: p.hash,
    lineUserIdEnc: p.enc,
    lineUserIdHashV: p.v,
    displayName,
    lastMessageAt,
  });
  return id;
}

async function seedEvent(userPk: string, event: 'follow' | 'unfollow', createdAt: Date) {
  const db = await getDb();
  await db.insert(lineFriendEvents).values({
    id: generateId(),
    lineUserId: userPk,
    event,
    webhookEventId: `it-fr-${generateId()}`,
    createdAt,
  });
}

async function cleanup() {
  const db = await getDb();
  const ids = [userA, userB, userC].filter(Boolean);
  if (ids.length > 0) {
    await db.delete(lineFriendEvents).where(inArray(lineFriendEvents.lineUserId, ids));
    await db.delete(lineUsers).where(inArray(lineUsers.id, ids));
  }
  // § กวาด orphan ข้ามไฟล์ (vitest รันไฟล์ขนานบน DB เดียว + กัน leftover จากรันที่ crash)
  const orphans = await db
    .select({ id: lineUsers.id })
    .from(lineUsers)
    .where(ilike(lineUsers.displayName, 'it-fr-สม%'));
  if (orphans.length > 0) {
    const orphanIds = orphans.map((o) => o.id);
    await db.delete(lineFriendEvents).where(inArray(lineFriendEvents.lineUserId, orphanIds));
    await db.delete(lineUsers).where(inArray(lineUsers.id, orphanIds));
  }
  userA = userB = userC = '';
}

beforeEach(async () => {
  await cleanup();
  const base = Date.now();
  // A ติดตามอยู่ (follow ล่าสุด), B เลิกติดตาม (unfollow ล่าสุด), C ไม่มี event
  userA = await seedUser(RAW_A, 'it-fr-สมชาย', new Date(base - 3000));
  userB = await seedUser(RAW_B, 'it-fr-สมหญิง', new Date(base - 2000));
  userC = await seedUser(RAW_C, 'it-fr-สมปอง', new Date(base - 1000));
  await seedEvent(userA, 'follow', new Date(base - 5000));
  await seedEvent(userB, 'follow', new Date(base - 6000));
  await seedEvent(userB, 'unfollow', new Date(base - 4000));
});

afterAll(async () => {
  await cleanup();
  await closeDb();
});

describe('GET /api/line/admin/friends', () => {
  test('คืนรายการพร้อม maskedId และไม่มี raw LINE id ปนใน response', async () => {
    // § scope ด้วย q prefix ของไฟล์นี้ — กันแถว seed จากไฟล์ test ที่รันขนานบน DB เดียวกัน
    const res = await GET(req('?q=it-fr-สม'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(3);

    const names = body.items.map((i: { displayName: string }) => i.displayName);
    expect(names).toEqual(expect.arrayContaining(['it-fr-สมชาย', 'it-fr-สมหญิง', 'it-fr-สมปอง']));

    const dumped = JSON.stringify(body);
    // § mask audit: raw id ต้องไม่ปรากฏที่ใดใน response (T5)
    expect(dumped).not.toContain(RAW_A);
    expect(dumped).not.toContain(RAW_B);
    expect(dumped).not.toContain(RAW_C);
    for (const item of body.items) {
      expect(item.maskedId).toMatch(/^.{8}$/);
      expect(item).not.toHaveProperty('lineUserIdEnc');
      expect(item).not.toHaveProperty('lineUserIdHash');
    }
  });

  test('GET เปล่าไม่พังและไม่เผย raw id ของไฟล์นี้', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const dumped = JSON.stringify(await res.json());
    expect(dumped).not.toContain(RAW_A);
    expect(dumped).not.toContain(RAW_B);
    expect(dumped).not.toContain(RAW_C);
  });

  test('follow state มาจาก event ล่าสุด + นับ follow/refollow ถูก', async () => {
    const res = await GET(req('?pageSize=100'));
    const body = await res.json();
    const byName = Object.fromEntries(
      body.items.map((i: { displayName: string; followState: string; followCount: number; refollowCount: number }) => [
        i.displayName,
        i,
      ]),
    );
    expect(byName['it-fr-สมชาย'].followState).toBe('following');
    expect(byName['it-fr-สมชาย'].followCount).toBe(1);
    expect(byName['it-fr-สมหญิง'].followState).toBe('unfollowed');
    expect(byName['it-fr-สมปอง'].followState).toBe('following');
    expect(byName['it-fr-สมปอง'].refollowCount).toBe(0);
  });

  test('search q กรองตามชื่อที่แสดง', async () => {
    const res = await GET(req('?q=สมหญิง'));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].displayName).toBe('it-fr-สมหญิง');
    expect(JSON.stringify(body)).not.toContain(RAW_B);
  });

  test('status=unfollowed เหลือเฉพาะคนเลิกติดตาม', async () => {
    const res = await GET(req('?status=unfollowed&q=it-fr-สม'));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].followState).toBe('unfollowed');
    expect(body.items[0].displayName).toBe('it-fr-สมหญิง');
  });

  test('status=following ตัดคนเลิกติดตามออก', async () => {
    const res = await GET(req('?status=following&q=it-fr-สม'));
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.items.every((i: { followState: string }) => i.followState === 'following')).toBe(true);
  });

  test('pagination แบ่งหน้าถูก + total ครบ + หน้าสองแถวไม่ซ้ำหน้าแรก', async () => {
    const first = await (await GET(req('?q=it-fr-สม&page=1&pageSize=2'))).json();
    expect(first.total).toBe(3);
    expect(first.items).toHaveLength(2);
    expect(first.page).toBe(1);

    const second = await (await GET(req('?q=it-fr-สม&page=2&pageSize=2'))).json();
    expect(second.total).toBe(3);
    expect(second.items).toHaveLength(1);
    const firstIds = first.items.map((i: { id: string }) => i.id);
    expect(firstIds).not.toContain(second.items[0].id);
  });

  test('status ผิด → 400 พร้อมข้อความไทย', async () => {
    const res = await GET(req('?status=blocked'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});
