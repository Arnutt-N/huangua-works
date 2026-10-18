import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { lineUsers } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';

export const runtime = 'nodejs';

// § ตัวเลือกผู้รับเฉพาะรายสำหรับ broadcast — คืนเฉพาะ PK ภายใน (line_users.id) กับชื่อแสดง
// ห้ามคืน raw LINE user id ออก API นี้ (raw id ใช้เฉพาะใน broadcast-service ตอนส่ง)
export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const db = await getDb();
  const rows = await db
    .select({ id: lineUsers.id, displayName: lineUsers.displayName })
    .from(lineUsers)
    .orderBy(desc(lineUsers.lastMessageAt))
    .limit(500);

  return NextResponse.json({ items: rows });
}
