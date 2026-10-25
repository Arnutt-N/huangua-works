import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { uploadMenuImage } from '@/lib/line/rich-menu-service';
import { RICH_MENU_IMAGE_LIMIT_BYTES } from '@/lib/contracts';

export const runtime = 'nodejs';

// § LINE รับรูปเมนูไม่เกิน 1MB — กันตั้งแต่ boundary ก่อนยิง LINE (แบบ jsk-app:
// frontend fit → endpoint 413 → pre-push fail-fast) ตรวจ magic bytes แทน
// Content-Type ที่ client ส่งมา (spoof ได้)
const MAX_IMAGE_BYTES = RICH_MENU_IMAGE_LIMIT_BYTES;

function sniffImageMime(buf: Buffer): 'image/png' | 'image/jpeg' | null {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get('file');
    if (value instanceof File) file = value;
  } catch {
    return NextResponse.json({ error: 'อ่านไฟล์ไม่สำเร็จ' }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'กรุณาเลือกไฟล์รูป' }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: 'รูปใหญ่เกิน 1 MB ที่ LINE รับได้ — กรุณาย่อรูปก่อนอัปโหลด' },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!sniffImageMime(buffer)) {
    return NextResponse.json({ error: 'รองรับเฉพาะรูป PNG หรือ JPEG' }, { status: 422 });
  }

  const result = await uploadMenuImage(id, buffer);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  await logAudit({
    userId: authz.ctx.user.id,
    action: AUDIT_ACTIONS.RICH_MENU_IMAGE_UPLOAD,
    resource: 'rich_menus',
    resourceId: id,
    ipAddress: authz.ctx.ipAddress,
    userAgent: authz.ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}
