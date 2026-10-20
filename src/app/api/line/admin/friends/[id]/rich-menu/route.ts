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

export const runtime = 'nodejs';

const assignSchema = z.object({
  richMenuId: z.string().min(1, 'กรุณาเลือก Rich Menu'),
});

// § ไม่มี link-helper รายคนใน lib/line/client (มีแต่ default/alias) และ rich-menu client
// เป็นของ PAR-8 จึงเรียก LINE per-user link API ตรงจาก route นี้ — ไม่แตะไฟล์นอก scope PAR-3
const LINE_API_BASE = 'https://api.line.me/v2/bot';
const LINE_TIMEOUT_MS = 10_000;

function lineToken(): string {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '';
}

async function callLine(method: 'POST' | 'DELETE', path: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const token = lineToken();
  if (!token) {
    return { ok: false, status: 503, error: 'ยังไม่ได้ตั้งค่า LINE channel' };
  }
  let res: Response;
  try {
    res = await fetch(`${LINE_API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(LINE_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 502, error: 'ติดต่อ LINE ไม่ได้ — ลองใหม่อีกครั้ง' };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, status: 502, error: detail.slice(0, 200) || `LINE ตอบกลับ ${res.status}` };
  }
  return { ok: true };
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
      .select({ id: richMenus.id, name: richMenus.name, lineRichMenuId: richMenus.lineRichMenuId })
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

  const linked = await callLine(
    'POST',
    `/user/${encodeURIComponent(rawLineUserId)}/richmenu/${encodeURIComponent(menu.lineRichMenuId)}`,
  );
  if (!linked.ok) {
    return NextResponse.json({ error: linked.error }, { status: linked.status });
  }

  const nextMetadata = {
    ...((user.metadata as { richMenuId?: string } | null) ?? {}),
    richMenuId: menu.id,
  };
  await db.update(lineUsers).set({ metadata: nextMetadata, updatedAt: new Date() }).where(eq(lineUsers.id, id));

  // § reuse RICH_MENU_UPDATE — AUDIT_ACTIONS เป็น closed map ของ shared lib (นอก scope PAR-3)
  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.RICH_MENU_UPDATE,
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
  const current = (user.metadata as { richMenuId?: string } | null)?.richMenuId ?? null;
  if (!current) {
    return NextResponse.json({ error: 'ผู้ใช้นี้ยังไม่มีริชเมนูเฉพาะบุคคล' }, { status: 404 });
  }

  const rawLineUserId = await resolveRawLineId(db, id);
  if (!rawLineUserId) {
    return NextResponse.json({ error: 'ถอดรหัส LINE id ไม่ได้ — ติดต่อผู้ดูแลระบบ' }, { status: 500 });
  }

  const unlinked = await callLine('DELETE', `/user/${encodeURIComponent(rawLineUserId)}/richmenu`);
  if (!unlinked.ok) {
    return NextResponse.json({ error: unlinked.error }, { status: unlinked.status });
  }

  const { richMenuId: _removed, ...rest } = (user.metadata as { richMenuId?: string } | null) ?? {};
  void _removed;
  await db.update(lineUsers).set({ metadata: rest, updatedAt: new Date() }).where(eq(lineUsers.id, id));

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.RICH_MENU_UPDATE,
    resource: 'line_users',
    resourceId: id,
    metadata: { richMenuId: null },
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}
