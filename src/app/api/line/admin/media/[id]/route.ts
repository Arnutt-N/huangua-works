import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { mediaFiles } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { deleteFile, keyFromUrl } from '@/lib/storage';

export const runtime = 'nodejs';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();

  const [row] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 });

  const key = keyFromUrl(row.url);
  if (!key) {
    return NextResponse.json(
      { error: 'ที่อยู่ไฟล์ไม่ตรงกับรูปแบบ storage — ลบไม่สำเร็จ' },
      { status: 409 },
    );
  }

  // § S3 DeleteObject idempotent — ลบไม่สำเร็จให้ DB ยังชี้ object ไว้ก่อน retry ได้ปลอดภัย
  // (เดิม .catch(() => {}) กลืน error แล้วลบ row ทิ้ง กลายเป็น object กำพร้าที่ไม่มีใครเห็น)
  try {
    await deleteFile(key);
  } catch {
    return NextResponse.json({ error: 'ลบไฟล์บน storage ไม่สำเร็จ' }, { status: 502 });
  }

  await db.delete(mediaFiles).where(eq(mediaFiles.id, id));

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.MEDIA_DELETE,
    resource: 'media_files',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}
