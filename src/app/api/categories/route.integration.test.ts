import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { GET } from './route';

afterAll(async () => {
  await closeDb();
});

describe('GET /api/categories', () => {
  test('returns 200 with a non-empty categories array', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.categories)).toBe(true);
    expect(body.categories.length).toBeGreaterThan(0);
  });

  test('each category only exposes the public shape', async () => {
    const res = await GET();
    const body = await res.json();

    for (const category of body.categories) {
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('slug');
      expect(category).toHaveProperty('estimatedDays');
      // isActive/createdAt/defaultDepartmentId are internal columns -- must not leak
      expect(category).not.toHaveProperty('isActive');
      expect(category).not.toHaveProperty('defaultDepartmentId');
    }
  });

  test('is ordered by name the same way the DB itself orders it', async () => {
    // เทียบกับ query ตรงที่มี ORDER BY เดียวกัน แทนการ re-sort ฝั่ง JS
    // (Postgres ใช้ collation ของ DB เอง อาจไม่ตรงกับ JS default/localeCompare)
    const db = await getDb();
    const expected = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(categories.name);

    const res = await GET();
    const body = await res.json();

    expect(body.categories.map((c: { id: string }) => c.id)).toEqual(expected.map((c) => c.id));
  });
});
