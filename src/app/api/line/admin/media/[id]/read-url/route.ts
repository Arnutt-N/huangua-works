import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { mediaFiles } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { readUrlForKey, dispositionFor, resolveReadKey, READ_URL_TTL_SECONDS } from '@/lib/storage';

export const runtime = 'nodejs';

/**
 * § ออก presigned GET สำหรับไฟล์เดียว — รับ **id เท่านั้น**
 * ห้ามรับ key จาก query/body: client ที่ล็อกอินได้จะขอ signed URL ของ key อะไรก็ได้
 * key มาจากแถวใน DB (storage_key ก่อน, url เดิมเป็น fallback ของแถวก่อน backfill)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const db = await getDb();
  const row = await firstOrUndefined(
    db
      .select({
        storageKey: mediaFiles.storageKey,
        url: mediaFiles.url,
        mimeType: mediaFiles.mimeType,
        filename: mediaFiles.filename,
      })
      .from(mediaFiles)
      .where(eq(mediaFiles.id, id))
      .limit(1),
  );
  if (!row) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 });

  const key = resolveReadKey({ storageKey: row.storageKey, legacyUrl: row.url });
  if (!key) {
    return NextResponse.json(
      { error: 'ที่อยู่ไฟล์ไม่ตรงกับรูปแบบ storage — ออกลิงก์ไม่ได้' },
      { status: 409 },
    );
  }

  const url = await readUrlForKey(key, {
    contentType: row.mimeType,
    disposition: dispositionFor(row.mimeType),
    filename: row.filename,
  });

  // § ไม่คืน key หรือ URL ของ storage — client ได้แค่ URL ที่เซ็นแล้ว
  return NextResponse.json({ url, expiresIn: READ_URL_TTL_SECONDS });
}
