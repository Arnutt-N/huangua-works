import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { richMenus } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getLineRichMenuImage } from '@/lib/line/client';

export const runtime = 'nodejs';

/**
 * § thumbnail ของ rich menu — ดึงรูปจริงจาก LINE แทนเก็บสำเนาใน S3
 * (LINE ผูกรูปกับ line_rich_menu_id ซึ่งเปลี่ยนทุกครั้งที่ recreate จึงเป็นแหล่งความจริงเดียว)
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
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
    return NextResponse.json({ error: 'เมนูนี้ยังไม่มีรูปบน LINE' }, { status: 404 });
  }

  try {
    const { bytes, contentType } = await getLineRichMenuImage(menu.lineRichMenuId);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': contentType,
        // § no-store: หลังอัปรูป/ซิงค์ ต้องเห็นรูปใหม่ทันที (ไม่มี etag ให้ revalidate)
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'ดึงรูปจาก LINE ไม่สำเร็จ' }, { status: 502 });
  }
}
