import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { getActiveOfficers } from '@/lib/queries/lookups';

export const runtime = 'nodejs';

export async function GET() {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const officers = await getActiveOfficers();

  return NextResponse.json(
    officers.map(({ id, fullName, role }) => ({ id, fullName, role })),
  );
}
