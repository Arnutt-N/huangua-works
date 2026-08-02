import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { mediaFiles } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { deleteFile } from '@/lib/storage';

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

  const key = row.url.split('/').slice(4).join('/');
  await deleteFile(key).catch(() => {});
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
