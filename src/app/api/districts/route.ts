/**
 * GET /api/districts?provinceId=N — ดึงอำเภอในจังหวัด (cascading dropdown ระดับ 2)
 * Public endpoint · reference data นิ่ง → cache ได้ 1 วัน
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { districts } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const provinceIdRaw = req.nextUrl.searchParams.get('provinceId');
  const provinceId = provinceIdRaw ? Number.parseInt(provinceIdRaw, 10) : NaN;

  if (!Number.isInteger(provinceId)) {
    return NextResponse.json({ error: 'provinceId ไม่ถูกต้อง' }, { status: 400 });
  }

  const db = await getDb();

  const all = await db
    .select()
    .from(districts)
    .where(eq(districts.provinceId, provinceId))
    .orderBy(asc(districts.nameTh));

  return NextResponse.json(
    {
      districts: all.map((d) => ({ id: d.id, nameTh: d.nameTh, nameEn: d.nameEn })),
    },
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
