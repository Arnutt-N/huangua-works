import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatCannedResponses } from '@/lib/db/schema';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { cannedResponseUpdateSchema } from '@/lib/validation';
import { isUniqueViolation } from '@/lib/db/errors';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(cannedResponseUpdateSchema, request);
  if (!result.ok) return result.response;

  const { id } = await params;
  const db = await getDb();

  try {
    const [updated] = await db
      .update(chatCannedResponses)
      .set({ ...result.data, updatedAt: new Date() })
      .where(eq(chatCannedResponses.id, id))
      .returning({ id: chatCannedResponses.id });

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'shortcut นี้ถูกใช้แล้ว' }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();

  // soft delete — เก็บไว้เผื่อข้อความเก่าอ้างถึง + กัน id ถูก reuse
  // ปล่อย shortcut คืน (partial unique index ครอบทุกแถวที่ shortcut ไม่ null)
  const [deleted] = await db
    .update(chatCannedResponses)
    .set({ isActive: false, shortcut: null, updatedAt: new Date() })
    .where(eq(chatCannedResponses.id, id))
    .returning({ id: chatCannedResponses.id });

  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
