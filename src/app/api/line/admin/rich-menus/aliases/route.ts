import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { createMenuAlias, listMenuAliases } from '@/lib/line/rich-menu-service';
import { isValidAliasId } from '@/lib/contracts';

export const runtime = 'nodejs';

const createSchema = z.object({
  aliasId: z.string().min(1).max(50),
  menuId: z.string().min(1),
});

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;
  return NextResponse.json({ items: await listMenuAliases() });
}

export async function POST(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(createSchema, request);
  if (!result.ok) return result.response;

  // § pattern เดียวกับ service — boundary ตรวจก่อน ไม่พึ่ง service อย่างเดียว
  if (!isValidAliasId(result.data.aliasId)) {
    return NextResponse.json({ error: 'ชื่อ alias ใช้ได้แค่ a-z A-Z 0-9 _ - ยาวไม่เกิน 50' }, { status: 400 });
  }

  const created = await createMenuAlias(result.data.aliasId, result.data.menuId);
  if (!created.ok) {
    return NextResponse.json(
      { error: created.error },
      { status: created.code === 'duplicate' ? 409 : 422 },
    );
  }

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.RICH_MENU_ALIAS_UPDATE,
    resource: 'rich_menu_aliases',
    resourceId: result.data.aliasId,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
