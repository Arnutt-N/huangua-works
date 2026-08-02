import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { mediaFiles } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { uploadFile, isStorageConfigured } from '@/lib/storage';

export const runtime = 'nodejs';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const db = await getDb();
  const rows = await db.select().from(mediaFiles).orderBy(desc(mediaFiles.createdAt)).limit(100);
  return NextResponse.json({ items: rows, storageConfigured: isStorageConfigured() });
}

export async function POST(request: Request) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'S3 storage ยังไม่ได้ตั้งค่า (S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)' }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const category = (formData.get('category') as string) || 'general';

  if (!file) return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 10MB' }, { status: 413 });

  const ext = file.name.split('.').pop() ?? 'bin';
  const key = `${category}/${generateId()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const url = await uploadFile(key, buffer, file.type || 'application/octet-stream');

  const db = await getDb();
  const id = generateId();
  await db.insert(mediaFiles).values({
    id,
    url,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    category: category as 'rich_menu' | 'image_message' | 'general',
    uploadedBy: authz.ctx.user.id,
  });

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.MEDIA_UPLOAD,
    resource: 'media_files',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true, id, url }, { status: 201 });
}
