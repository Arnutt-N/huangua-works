import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { districts, subDistricts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { GET } from './route';

let testDistrictId: number;

describe('GET /api/subdistricts', () => {
  beforeAll(async () => {
    const db = await getDb();
    const [district] = await db.select().from(districts).limit(1);
    if (!district) throw new Error('ไม่มี districts ใน DB — รัน `pnpm db:seed-geodata` ก่อน');
    testDistrictId = district.id;

    const count = await db.select({ id: subDistricts.id }).from(subDistricts).where(eq(subDistricts.districtId, testDistrictId)).limit(1);
    if (count.length === 0) throw new Error('ไม่มี subdistricts สำหรับ district ทดสอบ');
  });

  afterAll(async () => {
    await closeDb();
  });

  test('returns 200 with subdistricts for valid districtId', async () => {
    const req = new NextRequest(`http://localhost:3000/api/subdistricts?districtId=${testDistrictId}`);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.subdistricts).toBeInstanceOf(Array);
    expect(data.subdistricts.length).toBeGreaterThan(0);
  });

  test('each subdistrict has id, nameTh, nameEn, postalCode', async () => {
    const req = new NextRequest(`http://localhost:3000/api/subdistricts?districtId=${testDistrictId}`);
    const res = await GET(req);
    const data = await res.json();

    const first = data.subdistricts[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('nameTh');
    expect(first).toHaveProperty('nameEn');
    expect(first).toHaveProperty('postalCode');
  });

  test('returns 400 for missing districtId', async () => {
    const req = new NextRequest('http://localhost:3000/api/subdistricts');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  test('returns 400 for non-numeric districtId', async () => {
    const req = new NextRequest('http://localhost:3000/api/subdistricts?districtId=xyz');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  test('returns empty array for nonexistent districtId', async () => {
    const req = new NextRequest('http://localhost:3000/api/subdistricts?districtId=999999');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.subdistricts).toEqual([]);
  });
});
