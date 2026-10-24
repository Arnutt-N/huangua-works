import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { richMenus } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getRichMenuInsightDaily, LineApiError } from '@/lib/line/client';
import { validateInsightDailyRange } from '@/lib/line/insight-dates';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const url = new URL(request.url);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const invalid = validateInsightDailyRange(from, to);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });

  const db = await getDb();
  const menu = await firstOrUndefined(
    db
      .select({ lineRichMenuId: richMenus.lineRichMenuId })
      .from(richMenus)
      .where(eq(richMenus.id, id))
      .limit(1),
  );
  if (!menu) return NextResponse.json({ error: 'ไม่พบ rich menu' }, { status: 404 });
  if (!menu.lineRichMenuId) {
    return NextResponse.json({ error: 'ต้อง sync เมนูไป LINE ก่อนดูสถิติ' }, { status: 409 });
  }

  try {
    return NextResponse.json(await getRichMenuInsightDaily(menu.lineRichMenuId, from, to));
  } catch (err) {
    const status = err instanceof LineApiError ? err.status : 502;
    console.error(`[rich-menu-insights] daily ${id} failed: ${err instanceof Error ? err.message : 'unknown'}`);
    return NextResponse.json({ error: `LINE API error: ${status}` }, { status: 502 });
  }
}
