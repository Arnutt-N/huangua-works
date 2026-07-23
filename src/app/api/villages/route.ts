/**
 * GET /api/villages?subDistrictId=N — ดึงหมู่บ้านในตำบล (cascading dropdown ระดับ 4)
 * Public endpoint · reference data นิ่ง → cache ได้ 1 วัน
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { villages } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const subDistrictIdRaw = req.nextUrl.searchParams.get('subDistrictId');
  const subDistrictId = subDistrictIdRaw ? Number.parseInt(subDistrictIdRaw, 10) : NaN;

  if (!Number.isInteger(subDistrictId)) {
    return NextResponse.json({ error: 'subDistrictId ไม่ถูกต้อง' }, { status: 400 });
  }

  const db = await getDb();

  const all = await db
    .select({ id: villages.id, nameTh: villages.nameTh, code: villages.code })
    .from(villages)
    .where(eq(villages.subDistrictId, subDistrictId))
    .orderBy(asc(villages.nameTh));

  return NextResponse.json(
    { villages: all },
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
