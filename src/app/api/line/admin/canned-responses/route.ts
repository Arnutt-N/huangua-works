import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatCannedResponses } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { cannedResponseSchema, validateOrError } from '@/lib/validation';
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = validateOrError(cannedResponseSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const db = await getDb();
  const id = generateId();

  try {
    await db.insert(chatCannedResponses).values({
      id,
      title: validation.data.title,
      shortcut: validation.data.shortcut ?? null,
      content: validation.data.content,
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
