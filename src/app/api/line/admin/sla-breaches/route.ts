import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { listSlaBreaches } from '@/lib/line/chat/sla';

export const runtime = 'nodejs';

/** ห้องแชทที่เกิน SLA (คิวรอ / ตอบแรก / ดำเนินการ) — คำนวณจาก timestamp จริง */
export async function GET() {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const breaches = await listSlaBreaches();
  return NextResponse.json({ breaches });
}
