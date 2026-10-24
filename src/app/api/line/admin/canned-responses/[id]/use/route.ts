import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatCannedResponses } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();

  const [updated] = await db
    .update(chatCannedResponses)
    .set({ usageCount: sql`${chatCannedResponses.usageCount} + 1` })
    .where(eq(chatCannedResponses.id, id))
    .returning({ id: chatCannedResponses.id });

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
