import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { districts, provinces } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { GET } from './route';

let testProvinceId: number;

describe('GET /api/districts', () => {
  beforeAll(async () => {
    const db = await getDb();
    const [province] = await db.select().from(provinces).limit(1);
    if (!province) throw new Error('ไม่มี provinces ใน DB — รัน `pnpm db:seed-geodata` ก่อน');
    testProvinceId = province.id;

    const count = await db.select({ id: districts.id }).from(districts).where(eq(districts.provinceId, testProvinceId)).limit(1);
    if (count.length === 0) throw new Error('ไม่มี districts สำหรับ province ทดสอบ');
  });

  afterAll(async () => {
    await closeDb();
  });

  test('returns 200 with districts for valid provinceId', async () => {
    const req = new NextRequest(`http://localhost:3000/api/districts?provinceId=${testProvinceId}`);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.districts).toBeInstanceOf(Array);
    expect(data.districts.length).toBeGreaterThan(0);
  });

  test('each district has id, nameTh, nameEn', async () => {
    const req = new NextRequest(`http://localhost:3000/api/districts?provinceId=${testProvinceId}`);
    const res = await GET(req);
    const data = await res.json();

    const first = data.districts[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('nameTh');
    expect(first).toHaveProperty('nameEn');
  });

  test('returns 400 for missing provinceId', async () => {
    const req = new NextRequest('http://localhost:3000/api/districts');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  test('returns 400 for non-numeric provinceId', async () => {
    const req = new NextRequest('http://localhost:3000/api/districts?provinceId=abc');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  test('returns empty array for nonexistent provinceId', async () => {
    const req = new NextRequest('http://localhost:3000/api/districts?provinceId=999999');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.districts).toEqual([]);
  });
});
