import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { chatReplySchema } from '@/lib/validation';
import { parseBody } from '@/lib/api-helpers';
import { httpLineTransport, sendAdminReply } from '@/lib/line/conversation';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  // § parseBody ไม่ใช่ request.json()+validateOrError — ถ้า c8 merge ก่อน ห้าม revert กลับไป manual parse
  const parsed = await parseBody(chatReplySchema, request);
  if (!parsed.ok) return parsed.response;

  const { text, clientTempId } = parsed.data;
  const { id } = await params;

  const result = await sendAdminReply(
    { conversationId: id, adminUserId: authz.ctx.user.id, text, clientTempId },
    httpLineTransport,
  );

  switch (result.kind) {
    case 'not_found':
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    case 'push_failed':
      // ข้อความอยู่ใน DB แล้ว — client retry ด้วย tempId เดิมจะเข้า path retry push ไม่สร้างซ้ำ
      return NextResponse.json(
        { error: 'ส่งข้อความไป LINE ไม่สำเร็จ', messageId: result.messageId, pushStatus: 'failed' },
        { status: 502 },
      );
    case 'duplicate':
      return NextResponse.json({ ok: true, messageId: result.messageId, pushStatus: result.pushStatus, duplicate: true });
    case 'sent':
      return NextResponse.json({ ok: true, messageId: result.messageId, pushStatus: result.pushStatus });
  }
}
