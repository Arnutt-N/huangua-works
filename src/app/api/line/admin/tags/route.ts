import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatTags } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { chatTagSchema, validateOrError } from '@/lib/validation';
import { isUniqueViolation } from '@/lib/db/errors';

export const runtime = 'nodejs';

export async function GET() {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const db = await getDb();
  const rows = await db
    .select({ id: chatTags.id, name: chatTags.name, color: chatTags.color })
    .from(chatTags)
    .orderBy(asc(chatTags.name));

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

  const validation = validateOrError(chatTagSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const db = await getDb();
  const id = generateId();

  try {
    await db.insert(chatTags).values({ id, ...validation.data });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'มีป้ายชื่อนี้อยู่แล้ว' }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json(
    { ok: true, id, name: validation.data.name, color: validation.data.color },
    { status: 201 },
  );
}
