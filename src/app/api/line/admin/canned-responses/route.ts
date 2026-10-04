import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatCannedResponses } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { cannedResponseSchema } from '@/lib/validation';
import { isUniqueViolation } from '@/lib/db/errors';

export const runtime = 'nodejs';

export async function GET() {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const db = await getDb();
  const rows = await db
    .select({
      id: chatCannedResponses.id,
      title: chatCannedResponses.title,
      shortcut: chatCannedResponses.shortcut,
      content: chatCannedResponses.content,
    })
    .from(chatCannedResponses)
    .where(eq(chatCannedResponses.isActive, true))
    .orderBy(asc(chatCannedResponses.title));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(cannedResponseSchema, request);
  if (!result.ok) return result.response;

  const db = await getDb();
  const id = generateId();

  try {
    await db.insert(chatCannedResponses).values({
      id,
      title: result.data.title,
      shortcut: result.data.shortcut ?? null,
      content: result.data.content,
      createdBy: authz.ctx.user.id,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'shortcut นี้ถูกใช้แล้ว' }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
