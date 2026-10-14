import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { tierRoles } from '@/lib/db/schema';
import { ADMIN_ROLES } from './roles';
import { getTierRoles, setTierRoles } from './tiers';

beforeEach(async () => {
  const db = await getDb();
  await db.execute(sql`DELETE FROM tier_roles`);
});

afterAll(async () => {
  const db = await getDb();
  await db.execute(sql`DELETE FROM tier_roles`);
  await closeDb();
});

describe('tier matrix (DB)', () => {
  test('ไม่มีแถว → fallback ค่าคงที่', async () => {
    expect(await getTierRoles('admin')).toEqual([...ADMIN_ROLES]);
  });

  test('เขียน override → อ่านได้ค่าใหม่', async () => {
    expect((await setTierRoles('admin', ['head', 'superadmin'])).ok).toBe(true);
    expect(await getTierRoles('admin')).toEqual(['head', 'superadmin']);
  });

  test('tier superadmin ล็อก — เขียนไม่ลง ค่าเดิมไม่เปลี่ยน', async () => {
    const res = await setTierRoles('superadmin', ['head', 'superadmin']);
    expect(res.ok).toBe(false);
    const db = await getDb();
    const rows = await db.select().from(tierRoles).where(eq(tierRoles.tier, 'superadmin'));
    expect(rows).toHaveLength(0);
    expect(await getTierRoles('superadmin')).toEqual(['superadmin']);
  });

  test('ตัด superadmin ออกไม่ได้ — เขียนแล้วต้องยังมี superadmin อยู่เสมอ', async () => {
    expect((await setTierRoles('admin', ['head'])).ok).toBe(true);
    // § อ่านแถว DB ตรง (ไม่ผ่าน cache — ไม่มี Redis ใน test version bump มองไม่เห็น)
    const db = await getDb();
    const [row] = await db.select().from(tierRoles).where(eq(tierRoles.tier, 'admin'));
    expect([...row!.roles].sort()).toEqual(['head', 'superadmin']);
  });

  test('แถวเก่าก่อน #111 (ไม่มี superadmin) → อ่านแล้วยังมี superadmin (self-heal)', async () => {
    const db = await getDb();
    await db.insert(tierRoles).values({ tier: 'admin', roles: ['head'] });
    expect(await getTierRoles('admin')).toEqual(['head', 'superadmin']);
  });

  test('roles ว่าง → ปฏิเสธ ไม่ล็อกระบบ', async () => {
    const res = await setTierRoles('admin', []);
    expect(res.ok).toBe(false);
    expect(await getTierRoles('admin')).toEqual([...ADMIN_ROLES]);
  });
});
