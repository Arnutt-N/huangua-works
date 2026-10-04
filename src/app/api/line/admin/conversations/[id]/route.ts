import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatMessages, chatConversations, users } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { STAFF_ROLES } from '@/lib/auth/roles';
import {
  chatPagingQuerySchema,
  updateConversationSchema,
  validateOrError,
} from '@/lib/validation';
import { parseBody } from '@/lib/api-helpers';
import { changeMode, linkCase, transferOwnership } from '@/lib/line/conversation';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const url = new URL(request.url);
  const validation = validateOrError(chatPagingQuerySchema, {
    before: url.searchParams.get('before') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { before, limit } = validation.data;

  const db = await getDb();

  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1);

  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // cursor = message id (UUIDv7 เรียงตามเวลา) — ดึงใหม่สุด limit+1 แล้ว reverse
  // ให้ client ได้ messages เรียง asc เหมือนเดิม + รู้ว่ามีหน้าก่อนหน้าอีกไหม
  const page = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, id),
        before ? lt(chatMessages.id, before) : undefined,
      ),
    )
    .orderBy(desc(chatMessages.id))
    .limit(limit + 1);

  const hasMore = page.length > limit;
  const messages = page.slice(0, limit).reverse();

  return NextResponse.json({ conversation, messages, hasMore });
}

async function isActiveStaff(userId: string): Promise<boolean> {
  const db = await getDb();
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true), inArray(users.role, [...STAFF_ROLES])))
    .limit(1);
  return Boolean(target);
}

// ── โน้ตภายใน — autosave, ไม่ broadcast (กัน refetch ไป clobber draft ของแอดมินอื่น) ──
// ไม่ใช่การเปลี่ยนสถานะบทสนทนา จึงไม่อยู่ใน conversation module
async function saveAdminNote(id: string, adminNote: string | null, adminId: string) {
  const db = await getDb();
  const [noted] = await db
    .update(chatConversations)
    .set({ adminNote, adminNoteUpdatedAt: new Date(), adminNoteUpdatedBy: adminId, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
    .returning({ id: chatConversations.id });
  if (!noted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireStaffApi(STAFF_ROLES);
  if (!authz.ok) return authz.response;

  // § parseBody ไม่ใช่ request.json()+validateOrError — ถ้า c8 merge ก่อน ห้าม revert กลับไป manual parse
  const parsed = await parseBody(updateConversationSchema, request);
  if (!parsed.ok) return parsed.response;

  const { mode, linkedCaseId, assignedAdminId, transferReason, adminNote } = parsed.data;
  const { id } = await params;
  const actorId = authz.ctx.user.id;

  // ── โอนแชท / รับช่วงต่อ — path แยกจาก claim (mode ต้องเป็น human_active อยู่แล้ว) ──
  if (assignedAdminId !== undefined && mode === undefined) {
    // กันโอนให้ id ผี — ปลายทางต้องเป็นเจ้าหน้าที่ที่ยัง active จริง
    if (!(await isActiveStaff(assignedAdminId))) {
      return NextResponse.json({ error: 'ปลายทางไม่ใช่เจ้าหน้าที่ที่ใช้งานอยู่' }, { status: 400 });
    }
    const result = await transferOwnership(id, { toAdminId: assignedAdminId, byAdminId: actorId, reason: transferReason });
    if (result.ok) return NextResponse.json({ ok: true });
    if (result.reason === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: 'โอนแชทได้เฉพาะห้องที่เจ้าหน้าที่กำลังดูแลอยู่' }, { status: 409 });
  }

  if (adminNote !== undefined && mode === undefined && linkedCaseId === undefined) {
    return saveAdminNote(id, adminNote, actorId);
  }

  if (mode === undefined) {
    // schema refine + สอง branch ข้างบนรับประกันว่าเหลือแค่ linkedCaseId
    const linked = await linkCase(id, linkedCaseId ?? null);
    if (!linked.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // § claim/คืนบอท/ปิดเรื่อง ผ่าน changeMode — guard อยู่ใน WHERE (atomic) ตามตาราง MODE_TRANSITIONS
  // กันสองแอดมินกดรับพร้อมกันแล้วคนหลังทับเงียบ ๆ
  const result = await changeMode(id, mode, { actorAdminId: actorId, linkedCaseId });
  if (result.ok) return NextResponse.json({ ok: true });
  if (result.reason === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // § claim ห้องที่มีเจ้าของแล้ว — คงข้อความเดิม (client แสดงข้อความนี้ + เทสต์เดิมล็อกไว้)
  if (mode === 'human_active' && result.currentMode === 'human_active') {
    return NextResponse.json({ error: 'มีเจ้าหน้าที่รับเรื่องนี้แล้ว' }, { status: 409 });
  }
  return NextResponse.json(
    { error: mode === 'human_active' ? 'เปลี่ยนสถานะไม่ได้จากสถานะปัจจุบัน' : 'สถานะบทสนทนาเปลี่ยนไปแล้ว กรุณารีเฟรช' },
    { status: 409 },
  );
}
