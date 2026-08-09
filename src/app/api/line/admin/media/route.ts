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

// § category ไหลเข้า S3 key และเป็น pgEnum ใน media_files — ต้องตรวจกับ list ก่อน
// ไม่งั้นค่าอย่าง `../../x` เขียน object นอก prefix ที่ตั้งใจ แล้วค่อยพัง 500 ตอน insert
// (ไฟล์ขึ้น S3 ไปแล้วแต่ไม่มีแถวใน DB = ไฟล์ค้างที่ไม่มีใครตามลบ)
const MEDIA_CATEGORIES = ['rich_menu', 'image_message', 'general'] as const;
type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

// § allow-list ของชนิดไฟล์ — LINE rich menu/image message รับแค่ภาพ
// กัน SVG และ HTML ที่ถูกเสิร์ฟกลับมาจาก S3 origin พร้อม Content-Type ที่ client เป็นคนบอก
const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

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
  const rawCategory = (formData.get('category') as string) || 'general';

  if (!MEDIA_CATEGORIES.includes(rawCategory as MediaCategory)) {
    return NextResponse.json({ error: 'หมวดหมู่ไฟล์ไม่ถูกต้อง' }, { status: 400 });
  }
  const category = rawCategory as MediaCategory;

  if (!file) return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 10MB' }, { status: 413 });

  // § นามสกุลมาจาก MIME ที่อยู่ใน allow-list ไม่ใช่จาก file.name ที่ผู้อัปโหลดตั้งเอง
  // (`a.png/../../evil` ทำให้ file.name.split('.').pop() คืน path segment ทั้งท่อน)
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: 'รองรับเฉพาะไฟล์ภาพ PNG, JPEG, WebP' },
      { status: 415 },
    );
  }

  const key = `${category}/${generateId()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // § ส่ง Content-Type จาก allow-list ไม่ส่งต่อ file.type ดิบ
  const url = await uploadFile(key, buffer, file.type);

  const db = await getDb();
  const id = generateId();
  await db.insert(mediaFiles).values({
    id,
    url,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    category,
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
