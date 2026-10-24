import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pgCode } from '@/lib/db/errors';
import { richMenuAliases, richMenus } from '@/lib/db/schema';
import { deleteLineRichMenu, getDefaultLineRichMenu } from '@/lib/line/client';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';

export const runtime = 'nodejs';

const displayModeSchema = z.enum(['ALWAYS', 'SCHEDULED', 'MANUAL']);

const areaSchema = z.object({
  bounds: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  action: z
    .object({ type: z.string(), text: z.string().optional(), uri: z.string().optional(), richMenuAliasId: z.string().optional() })
    .passthrough(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  chatBarText: z.string().min(1).max(20).optional(),
  areas: z.array(areaSchema).min(1).optional(),
  displayMode: displayModeSchema.optional(),
  displayStartAt: z.string().datetime({ offset: true }).nullable().optional(),
  displayEndAt: z.string().datetime({ offset: true }).nullable().optional(),
});

function toDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return new Date(v);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();
  const [row] = await db.select().from(richMenus).where(eq(richMenus.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: 'ไม่พบ rich menu' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const result = await parseBody(patchSchema, request);
  if (!result.ok) return result.response;

  const db = await getDb();
  const [stored] = await db
    .select({
      id: richMenus.id,
      name: richMenus.name,
      chatBarText: richMenus.chatBarText,
      config: richMenus.config,
      lineRichMenuId: richMenus.lineRichMenuId,
      displayMode: richMenus.displayMode,
      displayStartAt: richMenus.displayStartAt,
      displayEndAt: richMenus.displayEndAt,
    })
    .from(richMenus)
    .where(eq(richMenus.id, id))
    .limit(1);
  if (!stored) {
    return NextResponse.json({ error: 'ไม่พบ rich menu' }, { status: 404 });
  }

  const { name, chatBarText, areas, displayMode } = result.data;
  const start = toDate(result.data.displayStartAt);
  const end = toDate(result.data.displayEndAt);

  if (
    name === undefined &&
    chatBarText === undefined &&
    areas === undefined &&
    displayMode === undefined &&
    start === undefined &&
    end === undefined
  ) {
    return NextResponse.json({ error: 'ไม่มีอะไรให้แก้' }, { status: 400 });
  }

  const effectiveStart = start !== undefined ? start : stored.displayStartAt;
  const effectiveEnd = end !== undefined ? end : stored.displayEndAt;
  const effectiveMode = displayMode ?? stored.displayMode;
  // § เทียบด้วย getTime (string ต่าง offset เรียงผิด — interrogate C-1)
  if (effectiveStart && effectiveEnd && effectiveEnd.getTime() <= effectiveStart.getTime()) {
    return NextResponse.json({ error: 'วันสิ้นสุดต้องหลังวันเริ่มแสดง' }, { status: 400 });
  }
  if (effectiveMode === 'SCHEDULED' && (!effectiveStart || !effectiveEnd)) {
    return NextResponse.json(
      { error: 'โหมด "ตามช่วงเวลา" ต้องระบุวันเวลาเริ่มต้นและสิ้นสุด' },
      { status: 400 },
    );
  }

  // § LINE config ฝัง name/chatBarText/areas/selected — แก้ฟิลด์ไหนต้องเขียนลง config ด้วย
  // ไม่งั้น sync ครั้งถัดไป (recreate) จะใช้ค่าเก่า
  const prevConfig = (stored.config ?? {}) as Record<string, unknown>;
  const nextName = name ?? stored.name;
  const nextBar = chatBarText ?? stored.chatBarText;
  const nextMode = effectiveMode;
  const configChanged =
    name !== undefined ||
    chatBarText !== undefined ||
    areas !== undefined ||
    displayMode !== undefined;
  const nextConfig = configChanged
    ? {
        ...prevConfig,
        name: nextName,
        chatBarText: nextBar,
        areas: areas ?? prevConfig.areas,
        selected: nextMode === 'ALWAYS',
      }
    : prevConfig;

  const patch: {
    name?: string;
    chatBarText?: string;
    config?: Record<string, unknown>;
    displayMode?: string;
    displayStartAt?: Date | null;
    displayEndAt?: Date | null;
    syncStatus?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (name !== undefined) patch.name = name;
  if (chatBarText !== undefined) patch.chatBarText = chatBarText;
  if (configChanged) patch.config = nextConfig;
  if (displayMode !== undefined) patch.displayMode = displayMode;
  if (start !== undefined) patch.displayStartAt = start;
  if (end !== undefined) patch.displayEndAt = end;
  // § LINE อัปเดตเมนูเดิมไม่ได้ ต้อง recreate ตอน sync ครั้งถัดไป — ติด PENDING ให้ UI เตือน
  if (configChanged && stored.lineRichMenuId) patch.syncStatus = 'pending';

  await db.update(richMenus).set(patch).where(eq(richMenus.id, id));

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.RICH_MENU_UPDATE,
    resource: 'rich_menus',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
    metadata: {
      before: {
        name: stored.name,
        chatBarText: stored.chatBarText,
        displayMode: stored.displayMode,
        displayStartAt: stored.displayStartAt,
        displayEndAt: stored.displayEndAt,
      },
      after: {
        name: nextName,
        chatBarText: nextBar,
        displayMode: nextMode,
        displayStartAt: patch.displayStartAt ?? stored.displayStartAt,
        displayEndAt: patch.displayEndAt ?? stored.displayEndAt,
      },
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();
  const [row] = await db
    .select({ id: richMenus.id, status: richMenus.status, lineRichMenuId: richMenus.lineRichMenuId })
    .from(richMenus)
    .where(eq(richMenus.id, id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: 'ไม่พบ rich menu' }, { status: 404 });
  }
  const [alias] = await db
    .select({ id: richMenuAliases.id })
    .from(richMenuAliases)
    .where(eq(richMenuAliases.richMenuId, id))
    .limit(1);
  // § ติด alias อยู่ลบไม่ได้ (ตรง FK RESTRICT) — บอกก่อน ไม่ให้ DB โยน error ดิบ
  if (alias) {
    return NextResponse.json({ error: 'ลบไม่ได้ มี alias ผูกอยู่ ให้ลบ alias ก่อน' }, { status: 409 });
  }
  // § ห้ามลบ default สด — ไม่งั้น LINE ชี้เมนูผีที่ tick ไม่มีวันปลด (round-2 verdict)
  if (row.status === 'active') {
    return NextResponse.json({ error: 'เมนูนี้กำลังใช้งาน ให้ปลด default ก่อนลบ' }, { status: 409 });
  }
  if (row.lineRichMenuId) {
    const currentDefault = await getDefaultLineRichMenu().catch(() => null);
    if (currentDefault === row.lineRichMenuId) {
      return NextResponse.json({ error: 'เมนูนี้เป็น default บน LINE อยู่ ให้ย้าย default ก่อนลบ' }, { status: 409 });
    }
    // § ลบ remote แบบ best-effort ก่อนลบแถว — เหลือ orphan บน LINE โควตารั่ว
    await deleteLineRichMenu(row.lineRichMenuId).catch(() => {});
  }

  let removed: Array<{ id: string }>;
  try {
    removed = await db.delete(richMenus).where(eq(richMenus.id, id)).returning({ id: richMenus.id });
  } catch (err) {
    // § alias แทรกกลางทาง (FK RESTRICT race) → 409 เดิม ไม่ใช่ 500 ดิบ
    if (pgCode(err) === '23503') {
      return NextResponse.json({ error: 'ลบไม่ได้ มี alias ผูกอยู่ ให้ลบ alias ก่อน' }, { status: 409 });
    }
    throw err;
  }
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
