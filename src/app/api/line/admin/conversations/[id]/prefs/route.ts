import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { chatAdminPrefs } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { chatPrefsSchema } from '@/lib/validation';
import { parseBody } from '@/lib/api-helpers';

export const runtime = 'nodejs';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(chatPrefsSchema, request);
  if (!result.ok) return result.response;

  const { pinned, muted } = result.data;
  const { id } = await params;
  const db = await getDb();

  // per-admin preference — upsert บน unique(adminUserId, conversationId); ไม่ broadcast
  await db
    .insert(chatAdminPrefs)
    .values({
      id: generateId(),
      adminUserId: authz.ctx.user.id,
      conversationId: id,
      pinned: pinned ?? false,
      muted: muted ?? false,
    })
    .onConflictDoUpdate({
      target: [chatAdminPrefs.adminUserId, chatAdminPrefs.conversationId],
      set: {
        ...(pinned !== undefined ? { pinned } : {}),
        ...(muted !== undefined ? { muted } : {}),
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}
