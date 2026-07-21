/**
 * GET /api/provinces — ดึงจังหวัดทั้งหมด (สำหรับ cascading dropdown ในฟอร์มแจ้งเรื่อง)
 * Public endpoint · reference data นิ่ง → cache ได้ 1 วัน
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { provinces } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  const db = await getDb();

  const all = await db.select().from(provinces).orderBy(asc(provinces.nameTh));

  return NextResponse.json(
    {
      provinces: all.map((p) => ({ id: p.id, nameTh: p.nameTh, nameEn: p.nameEn })),
    },
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
