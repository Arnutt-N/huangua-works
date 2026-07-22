import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { provinces, districts, subDistricts } from '@/lib/db/schema';
import { GET as getProvinces } from './route';

describe('GET /api/provinces', () => {
  beforeAll(async () => {
    const db = await getDb();
    const count = await db.select({ id: provinces.id }).from(provinces).limit(1);
    if (count.length === 0) throw new Error('ไม่มี provinces ใน DB — รัน `pnpm db:seed-geodata` ก่อน');
  });

  afterAll(async () => {
    await closeDb();
  });

  test('returns 200 with provinces array', async () => {
    const req = new NextRequest('http://localhost:3000/api/provinces');
    const res = await getProvinces(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.provinces).toBeInstanceOf(Array);
    expect(data.provinces.length).toBe(77);
  });

  test('each province has id, nameTh, nameEn', async () => {
    const req = new NextRequest('http://localhost:3000/api/provinces');
    const res = await getProvinces(req);
    const data = await res.json();

    const first = data.provinces[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('nameTh');
    expect(first).toHaveProperty('nameEn');
    expect(typeof first.id).toBe('number');
  });

  test('has Cache-Control header (1 day)', async () => {
    const req = new NextRequest('http://localhost:3000/api/provinces');
    const res = await getProvinces(req);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });
});
