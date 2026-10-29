import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatMessages } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { readUrlForKey, dispositionFor, resolveReadKey, READ_URL_TTL_SECONDS } from '@/lib/storage';

export const runtime = 'nodejs';

/**
 * § ออก presigned GET สำหรับไฟล์ที่ประชาชนส่งในห้องแชท — รับ messageId เท่านั้น
 * ห้ามรับ key จาก client (กันการขอ signed URL ของ key ที่ไม่ใช่ของแถวนี้)
 * key มาจาก storage_key ก่อน แล้ว fallback ไป media_url เดิมของแถวก่อน backfill
 *
 * § ต้องกรอง conversationId ด้วย ไม่ใช่แค่ messageId — กันการอ่านข้อความข้ามห้อง
 * ด้วย id ที่เดาได้
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const { id: conversationId, messageId } = await params;
  const db = await getDb();
  const row = await firstOrUndefined(
    db
      .select({
        storageKey: chatMessages.storageKey,
        mediaUrl: chatMessages.mediaUrl,
        messageType: chatMessages.messageType,
        metadata: chatMessages.metadata,
      })
      .from(chatMessages)
      .where(and(eq(chatMessages.id, messageId), eq(chatMessages.conversationId, conversationId)))
      .limit(1),
  );
  if (!row) return NextResponse.json({ error: 'ไม่พบข้อความ' }, { status: 404 });

  const key = resolveReadKey({ storageKey: row.storageKey, legacyUrl: row.mediaUrl });
  if (!key) {
    return NextResponse.json(
      { error: 'ข้อความนี้ไม่มีไฟล์ หรือที่อยู่ไฟล์ไม่ตรงกับรูปแบบ storage' },
      { status: 409 },
    );
  }

  const meta = (row.metadata ?? {}) as { contentType?: string; fileName?: string };
  const contentType = meta.contentType ?? 'application/octet-stream';
  const filename = meta.fileName ?? key.split('/').pop() ?? 'file';

  const url = await readUrlForKey(key, {
    contentType,
    disposition: dispositionFor(contentType),
    filename,
  });

  return NextResponse.json({ url, expiresIn: READ_URL_TTL_SECONDS });
}
