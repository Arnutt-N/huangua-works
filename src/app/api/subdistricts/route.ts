/**
 * GET /api/subdistricts?districtId=N — ดึงตำบลในอำเภอ (cascading dropdown ระดับ 3)
 * Public endpoint · reference data นิ่ง → cache ได้ 1 วัน
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { subDistricts } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const districtIdRaw = req.nextUrl.searchParams.get('districtId');
  const districtId = districtIdRaw ? Number.parseInt(districtIdRaw, 10) : NaN;

  if (!Number.isInteger(districtId)) {
    return NextResponse.json({ error: 'districtId ไม่ถูกต้อง' }, { status: 400 });
  }

  const db = await getDb();

  const all = await db
    .select()
    .from(subDistricts)
    .where(eq(subDistricts.districtId, districtId))
    .orderBy(asc(subDistricts.nameTh));

  return NextResponse.json(
    {
      subdistricts: all.map((s) => ({
        id: s.id,
        nameTh: s.nameTh,
        nameEn: s.nameEn,
        postalCode: s.postalCode,
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
