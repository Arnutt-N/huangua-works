import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { lineUsers, richMenus } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { parseBody } from '@/lib/api-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { resolveRawLineId } from '@/lib/line/identity';
import { LineApiError, linkUserRichMenu, unlinkUserRichMenu } from '@/lib/line/client';
import { getAssignedMenuId, withAssignedMenuId, withoutAssignedMenuId } from '../../assigned-menu';

export const runtime = 'nodejs';

const assignSchema = z.object({
  richMenuId: z.string().min(1, 'กรุณาเลือก Rich Menu'),
});

/** แปลง LINE error เป็นข้อความไทย — raw detail ลง server log เท่านั้น ไม่ส่งออก UI */
function lineErrorToThai(err: unknown): { status: number; error: string } {
  if (err instanceof LineApiError) {
    console.error(`[friends] LINE richmenu failed: ${err.endpoint} status=${err.status} detail=${err.message}`);
    if (err.status === 404) {
      return { status: 404, error: 'ไม่พบเมนูนี้บน LINE — กด Sync ที่หน้าริชเมนูอีกครั้ง' };
    }
    if (err.status === 400) {
      return { status: 422, error: 'LINE ปฏิเสธคำสั่ง — ตรวจสอบว่าเมนูยังใช้งานได้' };
    }
    if (err.status === 429) {
      return { status: 429, error: 'LINE จำกัดจำนวนคำสั่ง — รอสักครู่แล้วลองใหม่' };
    }
    return { status: 502, error: 'ติดต่อ LINE ไม่ได้ — ลองใหม่อีกครั้ง' };
  }
  console.error('[friends] LINE richmenu failed (network)', err);
  return { status: 502, error: 'ติดต่อ LINE ไม่ได้ — ลองใหม่อีกครั้ง' };
}

function noToken(): boolean {
  return !process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

type RouteParams = { params: Promise<{ id: string }> };

/** ผูกริชเมนูให้เพื่อนรายคน — ยิง LINE link แล้วจำ menu id ภายในไว้ใน metadata (รอด reload) */
export async function POST(request: Request, { params }: RouteParams) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;
  const { id } = await params;

  const body = await parseBody(assignSchema, request);
  if (!body.ok) return body.response;

  const db = await getDb();
  const menu = await firstOrUndefined(
    db
      .select({ id: richMenus.id, name: richMenus.name, lineRichMenuId: richMenus.lineRichMenuId, status: richMenus.status })
      .from(richMenus)
      .where(eq(richMenus.id, body.data.richMenuId))
      .limit(1),
  );
  if (!menu) {
    return NextResponse.json({ error: 'ไม่พบ Rich Menu นี้' }, { status: 404 });
  }
  if (!menu.lineRichMenuId) {
    return NextResponse.json(
      { error: 'เมนูนี้ยังไม่ได้ sync ขึ้น LINE — กด Sync ที่หน้าริชเมนูก่อน' },
      { status: 422 },
    );
  }
  if (menu.status === 'inactive') {
    return NextResponse.json({ error: 'เมนูนี้ถูกปิดใช้งานแล้ว — เลือกเมนูอื่น' }, { status: 422 });
  }

  const user = await firstOrUndefined(
    db
      .select({ id: lineUsers.id, metadata: lineUsers.metadata })
      .from(lineUsers)
      .where(eq(lineUsers.id, id))
      .limit(1),
  );
  if (!user) {
    return NextResponse.json({ error: 'ไม่พบเพื่อนคนนี้' }, { status: 404 });
  }

  // § raw id ถอดเฉพาะตอนยิงออก LINE แล้วทิ้งทันที — ไม่ใส่ response (T5)
  const rawLineUserId = await resolveRawLineId(db, id);
  if (!rawLineUserId) {
    return NextResponse.json({ error: 'ถอดรหัส LINE id ไม่ได้ — ติดต่อผู้ดูแลระบบ' }, { status: 500 });
  }
  if (noToken()) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า LINE channel' }, { status: 503 });
  }

  try {
    await linkUserRichMenu(rawLineUserId, menu.lineRichMenuId);
  } catch (err) {
    const mapped = lineErrorToThai(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  try {
    await db
      .update(lineUsers)
      .set({ metadata: withAssignedMenuId(user.metadata, menu.id), updatedAt: new Date() })
      .where(eq(lineUsers.id, id));
  } catch {
    // § LINE ผูกแล้วแต่บันทึกพัง — ชดเชยด้วยการปลดฝั่ง LINE กันสองฝั่งไม่ตรงกัน
    await unlinkUserRichMenu(rawLineUserId).catch(() => {});
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง' }, { status: 500 });
  }

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.RICH_MENU_ASSIGN,
    resource: 'line_users',
    resourceId: id,
    metadata: { richMenuId: menu.id },
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true, richMenuId: menu.id, richMenuName: menu.name });
}

/** ปลดริชเมนูเฉพาะบุคคล — ลบ link บน LINE (กลับไปใช้ default) แล้วล้าง metadata */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;
  const { id } = await params;

  const db = await getDb();
  const user = await firstOrUndefined(
    db
      .select({ id: lineUsers.id, metadata: lineUsers.metadata })
      .from(lineUsers)
      .where(eq(lineUsers.id, id))
      .limit(1),
  );
  if (!user) {
    return NextResponse.json({ error: 'ไม่พบเพื่อนคนนี้' }, { status: 404 });
  }
  if (!getAssignedMenuId(user.metadata)) {
    return NextResponse.json({ error: 'ผู้ใช้นี้ยังไม่มีริชเมนูเฉพาะบุคคล' }, { status: 404 });
  }

  const rawLineUserId = await resolveRawLineId(db, id);
  if (!rawLineUserId) {
    return NextResponse.json({ error: 'ถอดรหัส LINE id ไม่ได้ — ติดต่อผู้ดูแลระบบ' }, { status: 500 });
  }
  if (noToken()) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า LINE channel' }, { status: 503 });
  }

  try {
    await unlinkUserRichMenu(rawLineUserId);
  } catch (err) {
    // § 404 = ไม่มี link ฝั่ง LINE อยู่แล้ว (โดนลบจาก OA Manager ฯลฯ) — ล้าง metadata ต่อได้เลย
    // กันแถวค้างสถานะผูกตลอดกาลเพราะ retry ชน error เดิมซ้ำ
    if (!(err instanceof LineApiError) || err.status !== 404) {
      const mapped = lineErrorToThai(err);
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }
  }

  await db
    .update(lineUsers)
    .set({ metadata: withoutAssignedMenuId(user.metadata), updatedAt: new Date() })
    .where(eq(lineUsers.id, id));

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.RICH_MENU_UNASSIGN,
    resource: 'line_users',
    resourceId: id,
    metadata: { richMenuId: null },
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}
