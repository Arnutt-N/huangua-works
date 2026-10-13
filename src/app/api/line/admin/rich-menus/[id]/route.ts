import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { richMenuAliases, richMenus } from '@/lib/db/schema';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';

export const runtime = 'nodejs';

const patchSchema = z.object({
  displayStartAt: z.string().datetime({ offset: true }).nullable().optional(),
  displayEndAt: z.string().datetime({ offset: true }).nullable().optional(),
});

function toDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return new Date(v);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const result = await parseBody(patchSchema, request);
  if (!result.ok) return result.response;

  const start = toDate(result.data.displayStartAt);
  const end = toDate(result.data.displayEndAt);
  if (start && end && end <= start) {
    return NextResponse.json({ error: 'วันสิ้นสุดต้องหลังวันเริ่มแสดง' }, { status: 400 });
  }

  const db = await getDb();
  const patch: { displayStartAt?: Date | null; displayEndAt?: Date | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (start !== undefined) patch.displayStartAt = start;
  if (end !== undefined) patch.displayEndAt = end;

  const updated = await db.update(richMenus).set(patch).where(eq(richMenus.id, id)).returning({ id: richMenus.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: 'ไม่พบ rich menu' }, { status: 404 });
  }

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.RICH_MENU_UPDATE,
    resource: 'rich_menus',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();
  const [alias] = await db
    .select({ id: richMenuAliases.id })
    .from(richMenuAliases)
    .where(eq(richMenuAliases.richMenuId, id))
    .limit(1);
  // § ติด alias อยู่ลบไม่ได้ (ตรง FK RESTRICT) — บอกก่อน ไม่ให้ DB โยน error ดิบ
  if (alias) {
    return NextResponse.json({ error: 'ลบไม่ได้ มี alias ผูกอยู่ ให้ลบ alias ก่อน' }, { status: 409 });
  }

  const removed = await db.delete(richMenus).where(eq(richMenus.id, id)).returning({ id: richMenus.id });
  if (removed.length === 0) {
    return NextResponse.json({ error: 'ไม่พบ rich menu' }, { status: 404 });
  }

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.RICH_MENU_DELETE,
    resource: 'rich_menus',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}
