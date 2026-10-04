import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { richMenus } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { z } from 'zod';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  chatBarText: z.string().min(1).max(20).default('เมนู'),
  config: z.object({
    size: z.object({ width: z.number(), height: z.number() }),
    selected: z.boolean().default(true),
    name: z.string(),
    chatBarText: z.string(),
    areas: z.array(z.object({
      bounds: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
      action: z.object({ type: z.string(), text: z.string().optional(), uri: z.string().optional() }).passthrough(),
    })),
  }),
});

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const db = await getDb();
  const rows = await db.select().from(richMenus).orderBy(asc(richMenus.createdAt));
  return NextResponse.json({ items: rows });
}

export async function POST(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(createSchema, request);
  if (!result.ok) return result.response;

  const db = await getDb();
  const id = generateId();

  await db.insert(richMenus).values({
    id,
    name: result.data.name,
    chatBarText: result.data.chatBarText,
    config: result.data.config,
    createdBy: authz.ctx.user.id,
  });

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.RICH_MENU_CREATE,
    resource: 'rich_menus',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
