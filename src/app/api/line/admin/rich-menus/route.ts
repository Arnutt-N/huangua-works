import { NextResponse } from 'next/server';
import { asc, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { lineUsers, richMenus } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { findInvalidRichMenuArea, RICH_MENU_DISPLAY_MODES } from '@/lib/contracts';
import { z } from 'zod';

export const runtime = 'nodejs';

const displayModeSchema = z.enum(RICH_MENU_DISPLAY_MODES);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  chatBarText: z.string().min(1).max(20).default('เมนู'),
  displayMode: displayModeSchema.optional(),
  displayStartAt: z.string().datetime({ offset: true }).optional(),
  displayEndAt: z.string().datetime({ offset: true }).optional(),
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
  const rows = await db
    .select({
      id: richMenus.id,
      name: richMenus.name,
      chatBarText: richMenus.chatBarText,
      lineRichMenuId: richMenus.lineRichMenuId,
      status: richMenus.status,
      displayMode: richMenus.displayMode,
      syncStatus: richMenus.syncStatus,
      lastSyncError: richMenus.lastSyncError,
      imageUrl: richMenus.imageUrl,
      displayStartAt: richMenus.displayStartAt,
      displayEndAt: richMenus.displayEndAt,
      createdAt: richMenus.createdAt,
      userLinkCount: sql<number>`(
        SELECT count(*)::int FROM ${lineUsers}
        WHERE ${lineUsers.metadata}->>'richMenuId' = ${richMenus.id}
      )`,
    })
    .from(richMenus)
    .orderBy(asc(richMenus.createdAt));
  return NextResponse.json({ items: rows });
}

export async function POST(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const result = await parseBody(createSchema, request);
  if (!result.ok) return result.response;

  const db = await getDb();
  const id = generateId();

  // § client ตรวจ https แล้ว แต่ POST ตรงข้าม client ได้ — ต้องบังคับที่ boundary ด้วย
  const badUri = findInvalidRichMenuArea(result.data.config.areas);
  if (badUri) {
    return NextResponse.json(
      { error: `URL ของปุ่มเมนูต้องเป็น https เท่านั้น (พบ ${badUri})` },
      { status: 400 },
    );
  }

  const { displayStartAt, displayEndAt } = result.data;
  const displayMode = result.data.displayMode ?? 'ALWAYS';
  if (displayStartAt && displayEndAt && displayEndAt <= displayStartAt) {
    return NextResponse.json({ error: 'วันสิ้นสุดต้องหลังวันเริ่มแสดง' }, { status: 400 });
  }
  if (displayMode === 'SCHEDULED' && (!displayStartAt || !displayEndAt)) {
    return NextResponse.json(
      { error: 'โหมด "ตามช่วงเวลา" ต้องระบุวันเวลาเริ่มต้นและสิ้นสุด' },
      { status: 400 },
    );
  }

  await db.insert(richMenus).values({
    id,
    name: result.data.name,
    chatBarText: result.data.chatBarText,
    config: { ...result.data.config, selected: displayMode === 'ALWAYS' },
    displayMode,
    displayStartAt: displayStartAt ? new Date(displayStartAt) : null,
    displayEndAt: displayEndAt ? new Date(displayEndAt) : null,
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
