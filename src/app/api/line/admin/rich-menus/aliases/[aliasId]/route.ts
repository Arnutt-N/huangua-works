import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { deleteMenuAlias, repointMenuAlias } from '@/lib/line/rich-menu-service';
import { isValidAliasId } from '@/lib/contracts';

export const runtime = 'nodejs';

const repointSchema = z.object({ menuId: z.string().min(1) });

export async function PUT(request: Request, { params }: { params: Promise<{ aliasId: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { aliasId } = await params;
  if (!isValidAliasId(aliasId)) {
    return NextResponse.json({ error: 'ชื่อ alias ไม่ถูกต้อง' }, { status: 400 });
  }
  const result = await parseBody(repointSchema, request);
  if (!result.ok) return result.response;

  const moved = await repointMenuAlias(aliasId, result.data.menuId);
  if (!moved.ok) {
    return NextResponse.json(
      { error: moved.error },
      { status: moved.error === 'ไม่พบ alias นี้ในระบบ' ? 404 : 422 },
    );
  }

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.RICH_MENU_ALIAS_UPDATE,
    resource: 'rich_menu_aliases',
    resourceId: aliasId,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ aliasId: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { aliasId } = await params;
  if (!isValidAliasId(aliasId)) {
    return NextResponse.json({ error: 'ชื่อ alias ไม่ถูกต้อง' }, { status: 400 });
  }
  const removed = await deleteMenuAlias(aliasId);
  if (!removed.ok) {
    return NextResponse.json(
      { error: removed.error },
      { status: removed.code === 'not_found' ? 404 : 422 },
    );
  }

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.RICH_MENU_ALIAS_UPDATE,
    resource: 'rich_menu_aliases',
    resourceId: aliasId,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}
